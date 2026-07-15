const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { migrate } = require('../../src/db/migrate');
const pool = require('../../src/config/db');

const TEST_PREFIX = 'test_migrate_';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), TEST_PREFIX));
}

function writeMigration(dir, name, sql) {
  fs.writeFileSync(path.join(dir, name), sql);
}

async function cleanTestData() {
  await pool
    .query("DELETE FROM _migration_checksums WHERE name LIKE '999_%'")
    .catch(() => {});
  await pool
    .query("DELETE FROM _migrations WHERE name LIKE '999_%'")
    .catch(() => {});
}

describe('Migration Integrity', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
    await cleanTestData();
  });

  afterEach(async () => {
    await cleanTestData();
  });

  it('applies valid migration and stores checksum', async () => {
    const dir = tempDir();
    writeMigration(dir, '999_001_create_test.sql', 'SELECT 1;');

    await migrate(dir);

    const { rows } = await pool.query(
      "SELECT sha256 FROM _migration_checksums WHERE name = '999_001_create_test.sql'"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sha256).toBe(
      crypto.createHash('sha256').update('SELECT 1;', 'utf8').digest('hex')
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects migration with invalid filename', async () => {
    const dir = tempDir();
    writeMigration(dir, 'invalid.sql', 'SELECT 1;');

    await expect(migrate(dir)).rejects.toThrow('Invalid migration filename');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects migration with non-matching pattern', async () => {
    const dir = tempDir();
    writeMigration(dir, '01_test.sql', 'SELECT 1;');

    await expect(migrate(dir)).rejects.toThrow('Invalid migration filename');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects tampered migration content', async () => {
    const dir = tempDir();
    writeMigration(dir, '999_002_test.sql', 'SELECT 1;');
    await migrate(dir);

    writeMigration(dir, '999_002_test.sql', 'SELECT 2; -- tampered');

    await expect(migrate(dir)).rejects.toThrow('has been modified');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips unchanged already-applied migration', async () => {
    const dir = tempDir();
    writeMigration(dir, '999_003_test.sql', 'SELECT 1;');
    await migrate(dir);

    await expect(migrate(dir)).resolves.not.toThrow();

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('fails gracefully when migration file is unreadable', async () => {
    const dir = tempDir();
    writeMigration(dir, '999_004_unreadable.sql', 'SELECT 1;');

    const realReadFile = fs.promises.readFile;
    fs.promises.readFile = async () => {
      throw new Error('Simulated I/O error');
    };

    try {
      await expect(migrate(dir)).rejects.toThrow('Simulated I/O error');

      const { rows } = await pool.query(
        "SELECT 1 FROM _migrations WHERE name = '999_004_unreadable.sql'"
      );
      expect(rows).toHaveLength(0);
    } finally {
      fs.promises.readFile = realReadFile;
    }

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not open DB transaction when invalid filenames exist', async () => {
    const dir = tempDir();
    writeMigration(dir, 'invalid_name.sql', 'SELECT 1;');

    await expect(migrate(dir)).rejects.toThrow('Invalid migration filename');

    const { rows } = await pool.query(
      "SELECT 1 FROM _migrations WHERE name = 'invalid_name.sql'"
    );
    expect(rows).toHaveLength(0);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('pre-validates all files before starting transaction', async () => {
    const dir = tempDir();
    writeMigration(dir, '999_005_valid.sql', 'SELECT 1;');

    const { migrate: freshMigrate } = require('../../src/db/migrate');
    const realReadFile = fs.promises.readFile;
    fs.promises.readFile = async (...args) => {
      throw new Error('Simulated I/O error');
    };

    try {
      await expect(freshMigrate(dir)).rejects.toThrow('Simulated I/O error');

      const { rows } = await pool.query(
        "SELECT 1 FROM _migrations WHERE name = '999_005_valid.sql'"
      );
      expect(rows).toHaveLength(0);
    } finally {
      fs.promises.readFile = realReadFile;
    }

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects migrations with duplicate prefixes', async () => {
    const dir = tempDir();
    writeMigration(dir, '999_006_first.sql', 'SELECT 1;');
    writeMigration(dir, '999_006_second.sql', 'SELECT 2;');

    await expect(migrate(dir)).rejects.toThrow(
      'Duplicate migration prefix detected: 999'
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('automatically translates historical database records on migration run', async () => {
    const dir = tempDir();
    const oldName = '020_social_tasks_reminder_sent_at.sql';
    const newName = '023_social_tasks_reminder_sent_at.sql';

    const sql = 'SELECT 1;';
    const checksum = crypto
      .createHash('sha256')
      .update(sql, 'utf8')
      .digest('hex');
    writeMigration(dir, newName, sql);

    // Save existing newName migration if it exists in the database
    const existingMig = await pool.query(
      'SELECT name FROM _migrations WHERE name = $1',
      [newName]
    );
    const existingCheck = await pool.query(
      'SELECT sha256 FROM _migration_checksums WHERE name = $1',
      [newName]
    );
    const hadExisting = existingMig.rowCount > 0;
    const existingChecksumVal = existingCheck.rows[0]?.sha256;

    if (hadExisting) {
      await pool.query('DELETE FROM _migrations WHERE name = $1', [newName]);
      await pool.query('DELETE FROM _migration_checksums WHERE name = $1', [
        newName,
      ]);
    }

    await pool.query(
      'INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
      [oldName]
    );
    await pool.query(
      'INSERT INTO _migration_checksums (name, sha256) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [oldName, checksum]
    );

    try {
      await migrate(dir);

      const resMig = await pool.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [newName]
      );
      expect(resMig.rows).toHaveLength(1);

      const resOldMig = await pool.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [oldName]
      );
      expect(resOldMig.rows).toHaveLength(0);

      const resCheck = await pool.query(
        'SELECT sha256 FROM _migration_checksums WHERE name = $1',
        [newName]
      );
      expect(resCheck.rows).toHaveLength(1);
      expect(resCheck.rows[0].sha256).toBe(checksum);
    } finally {
      await pool
        .query('DELETE FROM _migrations WHERE name IN ($1, $2)', [
          oldName,
          newName,
        ])
        .catch(() => {});
      await pool
        .query('DELETE FROM _migration_checksums WHERE name IN ($1, $2)', [
          oldName,
          newName,
        ])
        .catch(() => {});

      // Restore existing migration if it had one
      if (hadExisting) {
        await pool
          .query('INSERT INTO _migrations (name) VALUES ($1)', [newName])
          .catch(() => {});
        await pool
          .query(
            'INSERT INTO _migration_checksums (name, sha256) VALUES ($1, $2)',
            [newName, existingChecksumVal]
          )
          .catch(() => {});
      }

      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
