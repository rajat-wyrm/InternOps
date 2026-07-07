/**
 * Integration tests for PATCH /api/users/:id/suspend
 * Covers GitHub Issue #468: Last Active Admin Suspension Vulnerability
 *
 * Test matrix:
 *   1. Admin cannot suspend themselves               → 400
 *   2. Admin cannot suspend the last active admin    → 400
 *   3. Admin can suspend another admin (2+ active)   → 200
 *   4. Admin can suspend an intern                   → 200
 *   5. Unsuspend (activate) still works              → 200
 *   6. DB trigger rejects direct SQL bypass          → DB exception
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

// Fixture emails — unique per run so parallel CI jobs don't collide
const SECOND_ADMIN_EMAIL = `admin2+run${runId}@internops.com`;
const INTERN_EMAIL = `intern+run${runId}@internops.com`;
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

async function refreshCsrfToken() {
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
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

  // Clean up any leftover fixture users from prior runs
  await pool.query(
    'UPDATE users SET suspended = FALSE WHERE email = ANY($1::text[])',
    [TEST_EMAILS]
  );
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [
    TEST_EMAILS,
  ]);

  // Fetch initial CSRF token (pre-login)
  cookies = {};
  await refreshCsrfToken();

  // Login as the seeded admin
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
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
  // every subsequent POST/PATCH will be rejected with 403 (CSRF mismatch),
  // which is exactly what caused secondAdminId/internId to end up undefined.
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

  // Create a second admin via the register endpoint (admin-only)
  const reg2 = await inject('POST', '/api/auth/register', {
    payload: {
      email: SECOND_ADMIN_EMAIL,
      password: 'SecondAdmin@123',
      role: 'ADMIN',
      fullName: 'Second Admin',
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
  const regIntern = await inject('POST', '/api/auth/register', {
    payload: {
      email: INTERN_EMAIL,
      password: 'Intern@123',
      role: 'INTERN',
      fullName: 'Test Intern',
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
    // Unsuspend fixture users before deleting (so FK / trigger state is clean)
    await pool.query(
      'UPDATE users SET suspended = FALSE WHERE email = ANY($1::text[])',
      [TEST_EMAILS]
    );
    await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [
      TEST_EMAILS,
    ]);
    await resetSeededAdminPassword();
    // Ensure seeded admin is always left active
    await pool.query('UPDATE users SET suspended = FALSE WHERE email = $1', [
      SEEDED_ADMIN_EMAIL,
    ]);
  } catch {
    /* best-effort cleanup */
  }
  await app.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /api/users/:id/suspend — Issue #468', () => {
  // ── Test 1 ────────────────────────────────────────────────────────────────
  it('should return 400 when an admin tries to suspend themselves', async () => {
    const res = await inject('PATCH', `/api/users/${seededAdminId}/suspend`, {
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('You cannot suspend your own account');
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  it('should return 400 when trying to suspend the last active admin', async () => {
    // Suspend the seeded admin directly via SQL so no app-level guard fires,
    // leaving the second admin as the only active admin.
    await pool.query('UPDATE users SET suspended = TRUE WHERE email = $1', [
      SEEDED_ADMIN_EMAIL,
    ]);

    // Now the second admin IS the last active admin.
    // Attempting to suspend them from the seeded admin's token must be blocked.
    // (The seeded admin's JWT is still valid even though they are now suspended
    // because the route only checks RBAC role, not the suspended flag.)
    const res = await inject('PATCH', `/api/users/${secondAdminId}/suspend`, {
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Cannot suspend the last active admin');

    // Restore the seeded admin so subsequent tests can use them normally
    await pool.query('UPDATE users SET suspended = FALSE WHERE email = $1', [
      SEEDED_ADMIN_EMAIL,
    ]);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  it('should return 200 when suspending an admin while multiple active admins exist', async () => {
    // Both admins are currently active
    const res = await inject('PATCH', `/api/users/${secondAdminId}/suspend`, {
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Suspended');

    // Restore for later tests
    await inject('PATCH', `/api/users/${secondAdminId}/activate`, {
      payload: {},
    });
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  it('should return 200 when suspending an intern', async () => {
    const res = await inject('PATCH', `/api/users/${internId}/suspend`, {
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Suspended');
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────
  it('should return 200 when unsuspending (activating) a user', async () => {
    // The intern was suspended in test 4
    const res = await inject('PATCH', `/api/users/${internId}/activate`, {
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Activated');
  });

  // ── Test 6 ────────────────────────────────────────────────────────────────
  it('should throw a DB exception when directly updating the last active admin via SQL', async () => {
    // Suspend the second admin so only the seeded admin is active
    await inject('PATCH', `/api/users/${secondAdminId}/suspend`, {
      payload: {},
    });

    // Attempt direct SQL bypass of the application layer — trigger must fire
    await expect(
      pool.query('UPDATE users SET suspended = TRUE WHERE id = $1', [
        seededAdminId,
      ])
    ).rejects.toThrow('Cannot suspend the last active admin');

    // Restore the second admin
    await inject('PATCH', `/api/users/${secondAdminId}/activate`, {
      payload: {},
    });
  });
});
