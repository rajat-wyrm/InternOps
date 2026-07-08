const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pino = require('pino');

const log = pino(
  process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : {}
);

const MIGRATION_REGEX = /^\d{3}_[a-z0-9_]+\.sql$/;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

const MIGRATION_RENAMES = {
  '003_password_reset.sql': '004_password_reset.sql',
  '010_member_details.sql': '005_member_details.sql',
  '011_email_verification.sql': '006_email_verification.sql',
  '012_departments_unique_name.sql': '007_departments_unique_name.sql',
  '012_notifications_deleted_at.sql': '008_notifications_deleted_at.sql',
  '013_task_assignments.sql': '009_task_assignments.sql',
  '014_password_reset_attempts.sql': '010_password_reset_attempts.sql',
  '015_update_rating_constraint.sql': '011_update_rating_constraint.sql',
  '015_users_email_lowercase.sql': '012_users_email_lowercase.sql',
  '016_create_ai_usage.sql': '013_create_ai_usage.sql',
  '016_department_delete_improvements.sql':
    '014_department_delete_improvements.sql',
  '016_last_admin_guard.sql': '015_last_admin_guard.sql',
  '017_last_admin_delete_guard.sql': '018_last_admin_delete_guard.sql',
  '018_meeting_online_link.sql': '019_meeting_online_link.sql',
  '018_users_email_active_unique_index.sql':
    '020_users_email_active_unique_index.sql',
  '019_add_social_actions_to_proof_submissions.sql':
    '021_add_social_actions_to_proof_submissions.sql',
  '019_proof_images.sql': '022_proof_images.sql',
  '020_social_tasks_reminder_sent_at.sql':
    '023_social_tasks_reminder_sent_at.sql',
};

const fsPromises = fs.promises;

async function readFileWithRetry(filePath, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const buffer = await fsPromises.readFile(filePath);
      if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return buffer.toString('utf8', 3);
      }
      return buffer.toString('utf8');
    } catch (err) {
      if (attempt === retries) {
        throw new Error(
          `Failed to read ${path.basename(filePath)} after ${retries} attempts: ${err.message}`
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * attempt)
      );
    }
  }
}

async function loadMigrations(dir) {
  const entries = await fsPromises.readdir(dir);
  const files = entries.filter((f) => f.endsWith('.sql')).sort();

  const migrations = [];
  const prefixes = new Set();
  for (const file of files) {
    if (!MIGRATION_REGEX.test(file)) {
      throw new Error(`Invalid migration filename: ${file}`);
    }
    const prefix = file.substring(0, 3);
    if (prefixes.has(prefix)) {
      throw new Error(`Duplicate migration prefix detected: ${prefix}`);
    }
    prefixes.add(prefix);

    const filePath = path.join(dir, file);
    const sql = await readFileWithRetry(filePath);
    const checksum = crypto
      .createHash('sha256')
      .update(sql, 'utf8')
      .digest('hex');
    migrations.push({ name: file, sql, checksum });
  }

  return migrations;
}

async function migrate(migrationsDir) {
  const dir = migrationsDir || path.resolve(__dirname, '../../migrations');
  const migrations = await loadMigrations(dir);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS _migration_checksums (
        name VARCHAR(255) PRIMARY KEY,
        sha256 VARCHAR(64) NOT NULL
      )
    `);

    // Handle historical renames automatically so they do not run again
    const { rows: appliedRows } = await client.query(
      'SELECT name FROM _migrations'
    );
    const appliedNames = new Set(appliedRows.map((r) => r.name));

    for (const [oldName, newName] of Object.entries(MIGRATION_RENAMES)) {
      if (appliedNames.has(oldName)) {
        if (!appliedNames.has(newName)) {
          log.info(
            { oldName, newName },
            'Renaming applied migration record in DB'
          );
          await client.query(
            'UPDATE _migrations SET name = $1 WHERE name = $2',
            [newName, oldName]
          );
          await client.query(
            'UPDATE _migration_checksums SET name = $1 WHERE name = $2',
            [newName, oldName]
          );
        } else {
          // If both exist (cleanup edge case), delete the redundant old record
          await client.query('DELETE FROM _migrations WHERE name = $1', [
            oldName,
          ]);
          await client.query(
            'DELETE FROM _migration_checksums WHERE name = $1',
            [oldName]
          );
        }
      }
    }

    for (const migration of migrations) {
      const { name, sql, checksum } = migration;

      const alreadyApplied = await client.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [name]
      );

      if (alreadyApplied.rowCount > 0) {
        const stored = await client.query(
          'SELECT sha256 FROM _migration_checksums WHERE name = $1',
          [name]
        );
        if (stored.rowCount > 0 && stored.rows[0].sha256 !== checksum) {
          throw new Error(
            `Migration "${name}" has been modified since it was applied. Expected checksum ${stored.rows[0].sha256}, got ${checksum}.`
          );
        }
        log.info({ migration: name }, 'Skipping (already applied)');
        continue;
      }

      try {
        await client.query(sql);
        log.info({ migration: name }, 'Migration applied');
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [
          name,
        ]);
        await client.query(
          'INSERT INTO _migration_checksums (name, sha256) VALUES ($1, $2)',
          [name, checksum]
        );
      } catch (execErr) {
        throw new Error(
          `Migration failed in file "${name}": ${execErr.message}\nSQL:\n${sql.substring(0, 500)}...`
        );
      }
    }

    await client.query('COMMIT');
    log.info('All pending migrations applied successfully.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    log.error({ err: e }, 'Migration error');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
