/**
 * Integration tests for DELETE /api/users/:id
 * Covers the last-active-admin soft-delete vulnerability fix.
 *
 * Test matrix:
 *   1. Admin cannot delete themselves                            → 400
 *   2. Admin cannot delete the last active admin                 → 400
 *   3. Admin can delete another admin when 2+ active admins exist → 200
 *   4. Admin can delete an intern                                → 200
 *   5. DB trigger blocks direct SQL soft-delete of last admin    → DB exception
 *
 * Regression: existing suspend protection is exercised in users.suspend.test.js
 * and is not modified here.
 */
const app = require('../../src/app');
const pool = require('../../src/config/db');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');
const runId = Date.now();
const SECOND_ADMIN_EMAIL = `del-admin2+run${runId}@internops.com`;
const INTERN_EMAIL = `del-intern+run${runId}@internops.com`;
const TEST_EMAILS = [SECOND_ADMIN_EMAIL, INTERN_EMAIL];
let csrfToken;
let cookies;
let accessToken;
let seededAdminId;
let secondAdminId;
let internId;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function authHeaders() {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  };
}
function inject(method, url, opts = {}) {
  return app.inject({
    method,
    url,
    cookies: { ...cookies, ...(opts.cookies || {}) },
    headers: { ...authHeaders(), ...(opts.headers || {}) },
    payload: opts.payload,
  });
}
/** Hard-delete a fixture user (ignores deleted_at so we can clean up soft-deleted rows). */
async function hardDelete(emails) {
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);
}
async function refreshCsrfToken() {
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/csrf-token',
    cookies,
  });
  csrfToken = JSON.parse(csrfRes.body).csrfToken;
  mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
  mergeCookies(cookies, csrfRes.cookies);
}
// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await app.ready();
  await resetSeededAdminPassword();

  // Clean up other users/admins that might be lingering from other tests
  try {
    await pool.query("DELETE FROM users WHERE role = 'ADMIN' AND email <> $1", [
      SEEDED_ADMIN_EMAIL,
    ]);
  } catch (err) {
    await pool.query('DELETE FROM refresh_tokens').catch(() => {});
    await pool.query('DELETE FROM ratings').catch(() => {});
    await pool.query('DELETE FROM attendance').catch(() => {});
    await pool.query('DELETE FROM meetings').catch(() => {});
    await pool.query('DELETE FROM audit').catch(() => {});
    await pool.query('DELETE FROM task_assignments').catch(() => {});
    await pool.query('DELETE FROM proof_submissions').catch(() => {});
    await pool.query('DELETE FROM social_tasks').catch(() => {});
  }

  // Suspend any other admins that couldn't be deleted due to FK constraints
  await pool.query(
    "UPDATE users SET suspended = TRUE WHERE role = 'ADMIN' AND email <> $1 AND email <> $2",
    [SEEDED_ADMIN_EMAIL, SECOND_ADMIN_EMAIL]
  );

  // Clean up any prior-run fixtures
  await hardDelete(TEST_EMAILS);
  // Fetch initial CSRF token (pre-login)
  cookies = {};
  await refreshCsrfToken();
  // Login as the seeded admin
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    cookies,
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
    payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
  });
  if (loginRes.statusCode !== 200) {
    throw new Error(
      `Admin login failed (${loginRes.statusCode}): ${loginRes.body}`
    );
  }
  accessToken = JSON.parse(loginRes.body).accessToken;
  mergeCookies(cookies, parseSetCookie(loginRes.headers['set-cookie']));
  // Login rotates the CSRF session — the pre-login csrfToken is now stale.
  // Re-fetch it before issuing any further state-changing requests, or
  // every subsequent POST/DELETE will be rejected with 403 (CSRF mismatch).
  await refreshCsrfToken();
  // Resolve the seeded admin's UUID
  const adminRow = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [SEEDED_ADMIN_EMAIL]
  );
  seededAdminId = adminRow.rows[0].id;
  if (!seededAdminId) {
    throw new Error('Failed to resolve seeded admin ID');
  }
  // Create a second admin
  const reg2 = await inject('POST', '/api/v1/auth/register', {
    payload: {
      email: SECOND_ADMIN_EMAIL,
      password: 'SecondAdmin@123',
      role: 'ADMIN',
      full_name: 'Second Admin (delete test)',
    },
  });
  if (reg2.statusCode !== 201) {
    throw new Error(
      `Failed to create second admin (${reg2.statusCode}): ${reg2.body}`
    );
  }
  secondAdminId = JSON.parse(reg2.body).id;
  if (!secondAdminId) {
    throw new Error(`Register response missing id: ${reg2.body}`);
  }
  // Create an intern
  const regIntern = await inject('POST', '/api/v1/auth/register', {
    payload: {
      email: INTERN_EMAIL,
      password: 'Intern@123',
      role: 'INTERN',
      full_name: 'Test Intern (delete test)',
    },
  });
  if (regIntern.statusCode !== 201) {
    throw new Error(
      `Failed to create intern (${regIntern.statusCode}): ${regIntern.body}`
    );
  }
  internId = JSON.parse(regIntern.body).id;
  if (!internId) {
    throw new Error(`Register response missing id: ${regIntern.body}`);
  }
});
afterAll(async () => {
  try {
    // Restore any suspended/deleted fixture rows so hard-delete can run
    await pool.query(
      `UPDATE users SET suspended = FALSE, deleted_at = NULL
       WHERE email = ANY($1::text[])`,
      [TEST_EMAILS]
    );
    await hardDelete(TEST_EMAILS);
    await resetSeededAdminPassword();
    // Ensure the seeded admin is always left in a clean state
    await pool.query(
      'UPDATE users SET suspended = FALSE, deleted_at = NULL WHERE email = $1',
      [SEEDED_ADMIN_EMAIL]
    );
  } catch {
    /* best-effort */
  }
  await app.close();
});
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DELETE /api/users/:id — last-active-admin delete guard', () => {
  // ── Test 1 ────────────────────────────────────────────────────────────────
  it('should return 400 when an admin tries to delete themselves', async () => {
    const res = await inject('DELETE', `/api/v1/users/${seededAdminId}`, {
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe(
      'You cannot delete your own account'
    );
  });
  // ── Test 2 ────────────────────────────────────────────────────────────────
  it('should return 400 when trying to delete the last active admin', async () => {
    // Soft-delete the seeded admin directly via SQL so no app-level guard fires,
    // leaving the second admin as the only active admin. Then try to delete
    // the second admin through the API — this must be blocked.
    await pool.query('UPDATE users SET deleted_at = NOW() WHERE email = $1', [
      SEEDED_ADMIN_EMAIL,
    ]);
    const res = await inject('DELETE', `/api/v1/users/${secondAdminId}`, {
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe(
      'Cannot delete the last active admin'
    );
    // Restore the seeded admin for subsequent tests
    await pool.query('UPDATE users SET deleted_at = NULL WHERE email = $1', [
      SEEDED_ADMIN_EMAIL,
    ]);
  });
  // ── Test 3 ────────────────────────────────────────────────────────────────
  it('should return 200 when deleting an admin while multiple active admins exist', async () => {
    // Both admins are currently active — deleting the second one must succeed
    const res = await inject('DELETE', `/api/v1/users/${secondAdminId}`, {
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Soft-deleted');
    // Restore for the remaining tests
    await pool.query('UPDATE users SET deleted_at = NULL WHERE email = $1', [
      SECOND_ADMIN_EMAIL,
    ]);
  });
  // ── Test 4 ────────────────────────────────────────────────────────────────
  it('should return 200 when deleting an intern', async () => {
    const res = await inject('DELETE', `/api/v1/users/${internId}`, {
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Soft-deleted');
    // Restore so afterAll cleanup can hard-delete cleanly
    await pool.query('UPDATE users SET deleted_at = NULL WHERE email = $1', [
      INTERN_EMAIL,
    ]);
  });
  // ── Test 5 ────────────────────────────────────────────────────────────────
  it('should throw a DB exception when directly soft-deleting the last active admin via SQL', async () => {
    // Soft-delete the second admin so only the seeded admin remains active
    await pool.query('UPDATE users SET deleted_at = NOW() WHERE email = $1', [
      SECOND_ADMIN_EMAIL,
    ]);
    const activeAdmins = await pool.query(
      "SELECT id, email, role, suspended, deleted_at FROM users WHERE role = 'ADMIN' AND suspended = FALSE AND deleted_at IS NULL"
    );
    console.log('ACTIVE ADMINS BEFORE DELETE:', activeAdmins.rows);
    // Direct SQL bypass must be rejected by the trigger
    await expect(
      pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [
        seededAdminId,
      ])
    ).rejects.toThrow('Cannot delete the last active admin');
    // Restore the second admin
    await pool.query('UPDATE users SET deleted_at = NULL WHERE email = $1', [
      SECOND_ADMIN_EMAIL,
    ]);
  });
});
