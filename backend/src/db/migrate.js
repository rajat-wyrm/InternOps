const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATION_REGEX = /^\d{3}_[a-z0-9_]+\.sql$/;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

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
  for (const file of files) {
    if (!MIGRATION_REGEX.test(file)) {
      throw new Error(`Invalid migration filename: ${file}`);
    }
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
        console.log(`Skipping (already applied): ${name}`);
        continue;
      }

      try {
        await client.query(sql);
        console.log(`Migration applied: ${name}`);
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
    console.log('All pending migrations applied successfully.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration error:', e.message);
    console.error(e.stack);
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
