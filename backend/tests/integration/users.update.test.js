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
const SECOND_ADMIN_EMAIL = `update-admin+${runId}@internops.com`;
const INTERN_EMAIL = `update-intern+${runId}@internops.com`;
const DUPLICATE_EMAIL = `update-duplicate+${runId}@internops.com`;
const TEST_EMAILS = [SECOND_ADMIN_EMAIL, INTERN_EMAIL, DUPLICATE_EMAIL];

let csrfToken;
let cookies;
let accessToken;
let seededAdminId;
let secondAdminId;
let internId;

function authHeaders() {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
  };
}

function inject(method, url, payload) {
  return app.inject({
    method,
    url,
    cookies,
    headers: authHeaders(),
    payload,
  });
}

async function refreshCsrfToken() {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/csrf-token',
    cookies,
  });
  csrfToken = JSON.parse(response.body).csrfToken;
  mergeCookies(cookies, parseSetCookie(response.headers['set-cookie']));
  mergeCookies(cookies, response.cookies);
}

beforeAll(async () => {
  await app.ready();
  await resetSeededAdminPassword();

  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [
    TEST_EMAILS,
  ]);

  cookies = {};
  await refreshCsrfToken();

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    cookies,
    headers: {
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    },
    payload: {
      email: SEEDED_ADMIN_EMAIL,
      password: SEEDED_ADMIN_PASSWORD,
    },
  });

  if (loginResponse.statusCode !== 200) {
    throw new Error(`Admin login failed: ${loginResponse.body}`);
  }

  accessToken = JSON.parse(loginResponse.body).accessToken;
  mergeCookies(cookies, parseSetCookie(loginResponse.headers['set-cookie']));
  await refreshCsrfToken();

  const adminResult = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [SEEDED_ADMIN_EMAIL]
  );
  seededAdminId = adminResult.rows[0].id;

  const secondAdminResponse = await inject('POST', '/api/v1/auth/register', {
    email: SECOND_ADMIN_EMAIL,
    password: 'SecondAdmin@123',
    role: 'ADMIN',
    full_name: 'Update Second Admin',
  });
  secondAdminId = JSON.parse(secondAdminResponse.body).id;

  const internResponse = await inject('POST', '/api/v1/auth/register', {
    email: INTERN_EMAIL,
    password: 'Intern@123',
    role: 'INTERN',
    full_name: 'Update Intern',
  });
  internId = JSON.parse(internResponse.body).id;

  await inject('POST', '/api/v1/auth/register', {
    email: DUPLICATE_EMAIL,
    password: 'Duplicate@123',
    role: 'INTERN',
    full_name: 'Duplicate User',
  });
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [
    TEST_EMAILS,
  ]);
  await pool.query('UPDATE users SET suspended = FALSE WHERE id = $1', [
    seededAdminId,
  ]);
  await resetSeededAdminPassword();
  await app.close();
});

describe('PATCH /api/v1/users/:id', () => {
  beforeEach(async () => {
    await pool.query(
      `UPDATE users
       SET suspended = FALSE, deleted_at = NULL, role = (CASE WHEN id = $3 THEN 'INTERN' ELSE 'ADMIN' END)::user_role
       WHERE id = ANY($1::uuid[]) OR id = $2`,
      [[seededAdminId, secondAdminId], internId, internId]
    );
  });

  it('updates editable user fields and normalizes email', async () => {
    const newEmail = `UPDATED-INTERN+${runId}@INTERNOps.com`;
    TEST_EMAILS.push(newEmail.toLowerCase());

    const response = await inject('PATCH', `/api/v1/users/${internId}`, {
      full_name: 'Updated Intern Name',
      email: newEmail,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.user.full_name).toBe('Updated Intern Name');
    expect(body.user.email).toBe(newEmail.toLowerCase());
  });

  it('rejects a duplicate email', async () => {
    const response = await inject('PATCH', `/api/v1/users/${internId}`, {
      email: DUPLICATE_EMAIL,
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toBe(
      'A user with this email already exists'
    );
  });

  it('returns 404 for an unknown user', async () => {
    const response = await inject(
      'PATCH',
      '/api/v1/users/00000000-0000-4000-8000-000000000000',
      { full_name: 'Missing User' }
    );

    expect(response.statusCode).toBe(404);
  });

  it('rejects invalid input', async () => {
    const response = await inject('PATCH', `/api/v1/users/${internId}`, {
      role: 'OWNER',
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects assigning the user as their own manager', async () => {
    const response = await inject('PATCH', `/api/v1/users/${internId}`, {
      manager_id: internId,
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe(
      'A user cannot manage their own account'
    );
  });

  it('rejects an invalid hierarchy assignment', async () => {
    const response = await inject('PATCH', `/api/v1/users/${secondAdminId}`, {
      manager_id: internId,
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/Invalid hierarchy/);
  });

  it('allows promoting an intern to TL through hierarchy-aware admin editing', async () => {
    const response = await inject('PATCH', `/api/v1/users/${internId}`, {
      role: 'TL',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).user.role).toBe('TL');
  });
  it('allows changing a TL to Captain when no reports block the demotion', async () => {
    await pool.query("UPDATE users SET role = 'TL' WHERE id = $1", [internId]);
    const response = await inject('PATCH', `/api/v1/users/${internId}`, {
      role: 'CAPTAIN',
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).user.role).toBe('CAPTAIN');
  });
  it('rejects demoting an existing Admin', async () => {
    const response = await inject('PATCH', `/api/v1/users/${secondAdminId}`, {
      role: 'TL',
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toBe(
      'Admin role is protected and cannot be changed.'
    );
  });

  it('rejects promoting a non-Admin user to Admin', async () => {
    const response = await inject('PATCH', `/api/v1/users/${internId}`, {
      role: 'ADMIN',
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toBe(
      'Admin role is protected and cannot be changed.'
    );
  });
  it('rejects updates after the authenticated admin is suspended', async () => {
    await pool.query('UPDATE users SET suspended = TRUE WHERE id = $1', [
      seededAdminId,
    ]);

    const response = await inject('PATCH', `/api/v1/users/${secondAdminId}`, {
      role: 'TL',
      manager_id: null,
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toBe('User unavailable');
  });
});
