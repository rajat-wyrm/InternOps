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
});
