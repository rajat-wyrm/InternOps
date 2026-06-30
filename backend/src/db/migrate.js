const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATION_REGEX = /^\d{3}_[a-z0-9_]+\.sql$/;

async function migrate(migrationsDir) {
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

    const dir = migrationsDir || path.resolve(__dirname, '../../migrations');
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!MIGRATION_REGEX.test(file)) {
        throw new Error(`Invalid migration filename: ${file}`);
      }

      const filePath = path.join(dir, file);
      let sql;
      try {
        const buffer = fs.readFileSync(filePath);
        if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
          sql = buffer.toString('utf8', 3);
        } else {
          sql = buffer.toString('utf8');
        }
      } catch (readErr) {
        throw new Error(`Failed to read ${file}: ${readErr.message}`);
      }

      const checksum = crypto
        .createHash('sha256')
        .update(sql, 'utf8')
        .digest('hex');

      const alreadyApplied = await client.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [file]
      );

      if (alreadyApplied.rowCount > 0) {
        const stored = await client.query(
          'SELECT sha256 FROM _migration_checksums WHERE name = $1',
          [file]
        );
        if (stored.rowCount > 0 && stored.rows[0].sha256 !== checksum) {
          throw new Error(
            `Migration "${file}" has been modified since it was applied. Expected checksum ${stored.rows[0].sha256}, got ${checksum}.`
          );
        }
        console.log(`Skipping (already applied): ${file}`);
        continue;
      }

      try {
        await client.query(sql);
        console.log(`Migration applied: ${file}`);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [
          file,
        ]);
        await client.query(
          'INSERT INTO _migration_checksums (name, sha256) VALUES ($1, $2)',
          [file, checksum]
        );
      } catch (execErr) {
        throw new Error(
          `Migration failed in file "${file}": ${execErr.message}\nSQL:\n${sql.substring(0, 500)}...`
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
