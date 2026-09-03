// Shared helpers for integration tests. Keeping these in one module
// means every suite starts from a known state and we can change the
// underlying behavior (cookie names, token shapes) without having to
// hunt through a dozen test files.

const SEEDED_ADMIN_EMAIL = 'admin@internops.com';
const SEEDED_ADMIN_PASSWORD = 'Admin@123';

// This specific mocked hash format is what argon2 mock produces.
// Using it directly ensures the password verifies correctly even with mocked argon2.
const SEEDED_ADMIN_MOCKED_HASH = `mocked_argon2_hash:${SEEDED_ADMIN_PASSWORD}`;

async function resetSeededAdminPassword() {
  const pool = require('../../src/config/db');
  // Store the mocked hash format directly so it works with both real and mocked argon2.
  // Tests run with mocked argon2, which will verify this hash correctly.
  await pool.query(
    'UPDATE users SET password_hash = $1, suspended = FALSE, deleted_at = NULL, must_change_password = FALSE WHERE lower(email) = lower($2)',
    [SEEDED_ADMIN_MOCKED_HASH, SEEDED_ADMIN_EMAIL]
  );
}

async function clearPasswordResetAttempts() {
  const pool = require('../../src/config/db');
  await pool.query('DELETE FROM password_reset_attempts');
}

// Clear brute-force login attempt records so tests that make failed login
// calls don't accumulate into a lockout for subsequent tests.
async function clearLoginAttempts() {
  const pool = require('../../src/config/db');
  await pool.query('DELETE FROM login_attempts');
}

// Parse a Set-Cookie header into a { name: value } map. Fastify inject
// exposes cookies as objects on `res.cookies` already, but the Set-Cookie
// strings are the source of truth when something else (axios) is the
// client. We accept both shapes.
function parseSetCookie(setCookie) {
  if (!setCookie) return {};
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const out = {};
  for (const raw of arr) {
    const part = raw.split(';')[0];
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

// Merge cookies into a request cookie jar. Accepts either:
//   - a plain { name: value } object
//   - a Fastify `res.cookies` array of { name, value, ...rest } objects
//   - the parsed output of parseSetCookie (plain object)
function mergeCookies(jar, cookies) {
  if (!cookies) return jar;
  // Fastify inject exposes res.cookies as an array of objects with a
  // `name` and `value`. Iterate that shape explicitly.
  if (Array.isArray(cookies)) {
    for (const c of cookies) {
      if (!c || typeof c.name !== 'string') continue;
      if (c.value === '' || c.value === 'deleted' || c.value == null) {
        delete jar[c.name];
      } else {
        jar[c.name] = String(c.value);
      }
    }
    return jar;
  }
  for (const [name, value] of Object.entries(cookies)) {
    if (value === '' || value === 'deleted' || value == null) {
      delete jar[name];
    } else {
      jar[name] = String(value);
    }
  }
  return jar;
}

module.exports = {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  clearPasswordResetAttempts,
  clearLoginAttempts,
  parseSetCookie,
  mergeCookies,
};
