'use strict';

/**
 * Canva OAuth — CSRF State Verification Tests
 *
 * Verifies that the /auth/callback route rejects requests with a missing or
 * forged state parameter before exchanging the authorization code, and that
 * a valid state is accepted exactly once (single-use).
 */

const app = require('../../src/app');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  clearLoginAttempts,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');

let cookies = {};
let csrfToken;
let accessToken;

function updateJar(res) {
  const parsed = parseSetCookie(res.headers['set-cookie']);
  mergeCookies(cookies, parsed);
  if (parsed['csrf-token']) csrfToken = parsed['csrf-token'];
}

function inject(method, url, opts = {}) {
  return app.inject({
    method,
    url,
    cookies: { ...cookies, ...(opts.cookies || {}) },
    headers: {
      'X-CSRF-Token': csrfToken,
      Origin: 'http://localhost:5173',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(opts.headers || {}),
    },
    payload: opts.payload,
  });
}

// Reach into the route module's state store so tests can plant a known state
// without going through the real /auth/url endpoint (which needs CANVA_CLIENT_ID).
function getStateStore() {
  // Re-require to get the live module instance (Jest caches modules)
  return require('../../src/modules/canva/routes').__stateStore;
}

beforeAll(async () => {
  await app.ready();
  await resetSeededAdminPassword();
  await clearLoginAttempts();

  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/csrf-token',
    headers: { Origin: 'http://localhost:5173' },
  });
  csrfToken = JSON.parse(csrfRes.body).csrfToken;
  updateJar(csrfRes);

  const loginRes = await inject('POST', '/api/v1/auth/login', {
    payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
  });
  updateJar(loginRes);
  accessToken = JSON.parse(loginRes.body).accessToken;
});

afterAll(async () => {
  await resetSeededAdminPassword();
  await app.close();
});

describe('Canva OAuth — CSRF state verification', () => {
  it('rejects callback with no state parameter', async () => {
    const res = await inject(
      'GET',
      '/api/v1/canva/auth/callback?code=legit_code'
    );
    // Redirects to the frontend with error=invalid_state
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('error=invalid_state');
  });

  it('rejects callback with a forged state that was never issued', async () => {
    const res = await inject(
      'GET',
      '/api/v1/canva/auth/callback?code=legit_code&state=attacker_forged_state'
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('error=invalid_state');
  });

  it('rejects callback after state has expired', async () => {
    // Get the admin user id from /users/me
    const meRes = await inject('GET', '/api/v1/users/me');
    const { id: userId } = JSON.parse(meRes.body);

    // Manually plant an already-expired state entry
    const { oauthStateStore } = require('../../src/modules/canva/routes');
    oauthStateStore.set(userId, {
      state: 'expired_state_value',
      expiresAt: Date.now() - 1, // already expired
    });

    const res = await inject(
      'GET',
      `/api/v1/canva/auth/callback?code=legit_code&state=expired_state_value`
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('error=invalid_state');
  });

  it('state is single-use — second callback with same state is rejected', async () => {
    const meRes = await inject('GET', '/api/v1/users/me');
    const { id: userId } = JSON.parse(meRes.body);

    const { oauthStateStore } = require('../../src/modules/canva/routes');
    const validState = 'single_use_state_abc123';
    oauthStateStore.set(userId, {
      state: validState,
      expiresAt: Date.now() + 60_000,
    });

    // First use — state is consumed (will fail at token exchange since CANVA is
    // not configured in test env, but state check passes and it won't be
    // invalid_state — it will be a different error or redirect)
    const first = await inject(
      'GET',
      `/api/v1/canva/auth/callback?code=any_code&state=${validState}`
    );
    expect(first.statusCode).toBe(302);
    expect(first.headers.location).not.toContain('error=invalid_state');

    // Second use — state already consumed, must be rejected
    const second = await inject(
      'GET',
      `/api/v1/canva/auth/callback?code=any_code&state=${validState}`
    );
    expect(second.statusCode).toBe(302);
    expect(second.headers.location).toContain('error=invalid_state');
  });

  it('rejects callback when error param is present regardless of state', async () => {
    const res = await inject(
      'GET',
      '/api/v1/canva/auth/callback?error=access_denied&state=anything'
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('error=access_denied');
  });
});
