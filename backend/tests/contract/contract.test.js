/**
 * Contract Tests — API Response Schema Validation
 *
 * Every test hits a real endpoint via Fastify inject and asserts that the
 * response body conforms to the Zod schema defined in responseSchemas.js.
 * A schema change that breaks the contract will cause the matching test to
 * fail, giving consumers an early warning before the frontend is affected.
 */

const app = require('../../src/app');
const schemas = require('./responseSchemas');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  clearLoginAttempts,
  parseSetCookie,
  mergeCookies,
} = require('../integration/helpers');

// ─── helpers ────────────────────────────────────────────────────────────────

function assertSchema(key, body) {
  const schema = schemas[key];
  if (!schema) throw new Error(`No response schema registered for "${key}"`);
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(
      `Contract violation for ${key}:\n` +
        result.error.issues
          .map((i) => `  [${i.path.join('.')}] ${i.message}`)
          .join('\n')
    );
  }
}

function parse(res) {
  return JSON.parse(res.body);
}

// ─── state ──────────────────────────────────────────────────────────────────

let cookies = {};
let csrfToken;
let accessToken;

function updateJar(res) {
  const parsed = parseSetCookie(res.headers['set-cookie']);
  mergeCookies(cookies, parsed);
  if (parsed['csrf-token']) csrfToken = parsed['csrf-token'];
}

function inject(method, url, opts = {}) {
  const hasBody = opts.payload !== undefined;
  return app.inject({
    method,
    url,
    cookies: { ...cookies, ...(opts.cookies || {}) },
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      'X-CSRF-Token': csrfToken,
      Origin: 'http://localhost:5173',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(opts.headers || {}),
    },
    payload: opts.payload,
  });
}

// ─── setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await app.ready();
  await resetSeededAdminPassword();
  await clearLoginAttempts();

  // Obtain CSRF token
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/csrf-token',
    headers: { Origin: 'http://localhost:5173' },
  });
  csrfToken = parse(csrfRes).csrfToken;
  updateJar(csrfRes);

  // Login once; reuse token for all authenticated tests
  const loginRes = await inject('POST', '/api/v1/auth/login', {
    payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
  });
  updateJar(loginRes);
  accessToken = parse(loginRes).accessToken;
});

afterAll(async () => {
  await resetSeededAdminPassword();
  await app.close();
});

// ─── Auth contracts ──────────────────────────────────────────────────────────

describe('Contract: Auth', () => {
  it('GET /api/v1/auth/csrf-token returns csrfToken string', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf-token',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.statusCode).toBe(200);
    assertSchema('GET /api/v1/auth/csrf-token', parse(res));
  });

  it('POST /api/v1/auth/login returns accessToken + user', async () => {
    await resetSeededAdminPassword();
    const res = await inject('POST', '/api/v1/auth/login', {
      payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
    });
    updateJar(res);
    accessToken = parse(res).accessToken;
    expect(res.statusCode).toBe(200);
    assertSchema('POST /api/v1/auth/login', parse(res));
  });

  it('POST /api/v1/auth/refresh returns accessToken + user', async () => {
    const res = await inject('POST', '/api/v1/auth/refresh', { payload: {} });
    updateJar(res);
    expect(res.statusCode).toBe(200);
    assertSchema('POST /api/v1/auth/refresh', parse(res));
    accessToken = parse(res).accessToken;
  });

  it('POST /api/v1/auth/forgot-password returns message', async () => {
    const res = await inject('POST', '/api/v1/auth/forgot-password', {
      payload: { email: 'nonexistent@example.com' },
    });
    expect(res.statusCode).toBe(200);
    assertSchema('POST /api/v1/auth/forgot-password', parse(res));
  });

  it('POST /api/v1/auth/logout returns message', async () => {
    // Re-login so we have a fresh refresh cookie to revoke
    await resetSeededAdminPassword();
    const loginRes = await inject('POST', '/api/v1/auth/login', {
      payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
    });
    updateJar(loginRes);
    const token = parse(loginRes).accessToken;

    const res = await inject('POST', '/api/v1/auth/logout', {
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    assertSchema('POST /api/v1/auth/logout', parse(res));

    // Re-login so subsequent tests have a valid token
    await resetSeededAdminPassword();
    const relogin = await inject('POST', '/api/v1/auth/login', {
      payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
    });
    updateJar(relogin);
    accessToken = parse(relogin).accessToken;
  });

  it('POST /api/v1/auth/login 401 error conforms to error schema', async () => {
    const res = await inject('POST', '/api/v1/auth/login', {
      payload: { email: SEEDED_ADMIN_EMAIL, password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    assertSchema('_error', parse(res));
  });
});

// ─── Users contracts ─────────────────────────────────────────────────────────

describe('Contract: Users', () => {
  it('GET /api/v1/users/me returns user object', async () => {
    const res = await inject('GET', '/api/v1/users/me');
    expect(res.statusCode).toBe(200);
    assertSchema('GET /api/v1/users/me', parse(res));
  });

  it('GET /api/v1/users returns paginated user list', async () => {
    const res = await inject('GET', '/api/v1/users');
    expect(res.statusCode).toBe(200);
    assertSchema('GET /api/v1/users', parse(res));
  });

  it('PATCH /api/v1/users/me returns message', async () => {
    const res = await inject('PATCH', '/api/v1/users/me', {
      payload: { full_name: 'Contract Test Admin' },
    });
    expect(res.statusCode).toBe(200);
    assertSchema('PATCH /api/v1/users/me', parse(res));
  });

  it('PATCH /api/v1/users/me/password returns message', async () => {
    const res = await inject('PATCH', '/api/v1/users/me/password', {
      payload: {
        oldPassword: SEEDED_ADMIN_PASSWORD,
        newPassword: SEEDED_ADMIN_PASSWORD,
      },
    });
    expect(res.statusCode).toBe(200);
    assertSchema('PATCH /api/v1/users/me/password', parse(res));
  });

  it('GET /api/v1/users 401 without token conforms to error schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.statusCode).toBe(401);
    assertSchema('_error', parse(res));
  });
});

// ─── Departments contracts ────────────────────────────────────────────────────

describe('Contract: Departments', () => {
  let deptId;

  it('POST /api/v1/departments returns department object', async () => {
    const res = await inject('POST', '/api/v1/departments', {
      payload: { name: `ContractDept_${Date.now()}` },
    });
    expect(res.statusCode).toBe(200);
    assertSchema('POST /api/v1/departments', parse(res));
    deptId = parse(res).id;
  });

  it('GET /api/v1/departments returns array of departments', async () => {
    const res = await inject('GET', '/api/v1/departments');
    expect(res.statusCode).toBe(200);
    assertSchema('GET /api/v1/departments', parse(res));
  });

  it('DELETE /api/v1/departments/:id returns success + force', async () => {
    if (!deptId) return;
    const res = await inject('DELETE', `/api/v1/departments/${deptId}`);
    expect(res.statusCode).toBe(200);
    assertSchema('DELETE /api/v1/departments/:id', parse(res));
  });
});

// ─── Notifications contracts ──────────────────────────────────────────────────

describe('Contract: Notifications', () => {
  it('GET /api/v1/notifications returns paginated list', async () => {
    const res = await inject('GET', '/api/v1/notifications');
    expect(res.statusCode).toBe(200);
    assertSchema('GET /api/v1/notifications', parse(res));
  });

  it('GET /api/v1/notifications/unread-count returns unread integer', async () => {
    const res = await inject('GET', '/api/v1/notifications/unread-count');
    expect(res.statusCode).toBe(200);
    assertSchema('GET /api/v1/notifications/unread-count', parse(res));
  });

  it('POST /api/v1/notifications/read-all returns success', async () => {
    const res = await inject('POST', '/api/v1/notifications/read-all', {
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    assertSchema('POST /api/v1/notifications/read-all', parse(res));
  });

  it('DELETE /api/v1/notifications/all returns success', async () => {
    const res = await inject('DELETE', '/api/v1/notifications/all');
    expect(res.statusCode).toBe(200);
    assertSchema('DELETE /api/v1/notifications/all', parse(res));
  });
});
