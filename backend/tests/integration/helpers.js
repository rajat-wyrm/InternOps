// Shared helpers for integration tests. Keeping these in one module
// means every suite starts from a known state and we can change the
// underlying behavior (cookie names, token shapes) without having to
// hunt through a dozen test files.

const argon2 = require('argon2');
const pool = require('../../src/config/db');

const SEEDED_ADMIN_EMAIL = 'admin@internops.com';
const SEEDED_ADMIN_PASSWORD = 'Admin@123';

async function resetSeededAdminPassword() {
  const hash = await argon2.hash(SEEDED_ADMIN_PASSWORD);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
    hash,
    SEEDED_ADMIN_EMAIL,
  ]);
}

async function clearPasswordResetAttempts() {
  await pool.query('DELETE FROM password_reset_attempts');
}

// Clear brute-force login attempt records so tests that make failed login
// calls don't accumulate into a lockout for subsequent tests.
async function clearLoginAttempts() {
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
