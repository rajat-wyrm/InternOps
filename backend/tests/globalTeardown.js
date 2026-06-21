// Global teardown — runs once after all test files. We re-hash the
// seeded admin password to its known value so the next CI run (or
// developer run) starts from a known state. Leaving the password
// mutated between runs was the original cause of the cascading
// 401 errors.
const argon2 = require('argon2');
const pool = require('../src/config/db');

const SEEDED_ADMIN_EMAIL = 'admin@internops.com';
const SEEDED_ADMIN_PASSWORD = 'Admin@123';

module.exports = async function globalTeardown() {
  try {
    const hash = await argon2.hash(SEEDED_ADMIN_PASSWORD);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
      hash,
      SEEDED_ADMIN_EMAIL,
    ]);
    await pool.query('DELETE FROM password_reset_attempts');
  } catch (err) {
    console.error('[jest teardown] failed to reset admin state:', err.message);
  } finally {
    await pool.end().catch(() => {});
  }
};
