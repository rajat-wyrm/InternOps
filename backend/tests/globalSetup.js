// Global setup — runs once before any test file. We open a pool
// connection and reset the seeded admin password to its known value so
// every test suite starts from the same state. This protects against
// cascading failures where a previous run left the password changed.const argon2 = require('argon2');

const argon2 = require('argon2');
const pool = require('../src/config/db');

const SEEDED_ADMIN_EMAIL = 'admin@internops.com';
const SEEDED_ADMIN_PASSWORD = 'Admin@123';

module.exports = async function globalSetup() {
  try {
    // Make sure the DB is reachable. The CI workflow already does this,
    // but local runs benefit from a clear failure mode.
    await pool.query('SELECT 1');

    const hash = await argon2.hash(SEEDED_ADMIN_PASSWORD);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
      hash,
      SEEDED_ADMIN_EMAIL,
    ]);

    // Wipe password-reset attempt counters so they don't bleed between
    // test files.
    await pool.query('DELETE FROM password_reset_attempts');
  } catch (err) {
    console.warn(
      '[jest setup] database unavailable — skipping DB reset:',
      err.message
    );
  }
};
