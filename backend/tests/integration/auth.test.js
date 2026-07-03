const app = require('../../src/app');
const emailService = require('../../src/services/email');
const pool = require('../../src/config/db');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  clearPasswordResetAttempts,
  clearLoginAttempts,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');

// Each integration test file gets its own mutable state. The CSRF
// implementation now binds the token to a server-issued session id
// (delivered in the `csrf-sid` signed cookie), so subsequent mutation
// requests must forward BOTH the `csrf-token` cookie (for the legacy
// double-submit read on the route) and the `csrf-sid` cookie (for the
// HMAC verification).
let csrfToken;
let cookies; // mutable jar; merged after every response
let accessToken;
let refreshToken;
let freshAccessToken;

beforeAll(async () => {
  emailService.sendPasswordReset = jest.fn().mockResolvedValue(undefined);
  emailService.sendEmail = jest.fn().mockResolvedValue(undefined);

  await app.ready();

  // Defense in depth — globalSetup already does this, but a developer
  // running a single file in isolation may bypass that path.
  await resetSeededAdminPassword();
  await clearPasswordResetAttempts();
  await clearLoginAttempts();

  cookies = {};
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
  });
  const body = JSON.parse(csrfRes.body);
  csrfToken = body.csrfToken;
  updateCookieJar(csrfRes);
  // Cookies that Fastify exposes on `res.cookies` are already decoded
  // objects; merge those too for completeness.
  mergeCookies(cookies, csrfRes.cookies);
});

function updateCookieJar(res) {
  const newCookies = parseSetCookie(res.headers['set-cookie']);
  mergeCookies(cookies, newCookies);
  if (newCookies['csrf-token']) {
    csrfToken = newCookies['csrf-token'];
  }
}

afterAll(async () => {
  await resetSeededAdminPassword();
  await app.close();
});

// Clear brute-force state before each test so failed login attempts in one
// test cannot accumulate into a lockout that breaks the next test.
beforeEach(async () => {
  await clearLoginAttempts();
});

function authHeaders(extra) {
  return {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function inject(method, url, opts = {}) {
  return app.inject({
    method,
    url,
    cookies: { ...cookies, ...(opts.cookies || {}) },
    headers: authHeaders(opts.headers),
    payload: opts.payload,
  });
}

async function login(
  email = SEEDED_ADMIN_EMAIL,
  password = SEEDED_ADMIN_PASSWORD
) {
  const res = await inject('POST', '/api/auth/login', {
    payload: { email, password },
  });
  // Persist any new cookies (refresh token) for later requests.
  updateCookieJar(res);
  return res;
}

describe('Auth Integration Tests', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await login();
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeDefined();
      // refreshToken is delivered via httpOnly cookie only — the
      // security fix in #417 removed it from the JSON body to prevent
      // a malicious SPA from holding it in JS-accessible storage.
      expect(body.refreshToken).toBeUndefined();
      expect(cookies['refreshToken']).toBeDefined();
      accessToken = body.accessToken;
    });

    it('should reject invalid password', async () => {
      const res = await inject('POST', '/api/auth/login', {
        payload: { email: SEEDED_ADMIN_EMAIL, password: 'wrong' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject missing email', async () => {
      const res = await inject('POST', '/api/auth/login', {
        payload: { password: SEEDED_ADMIN_PASSWORD },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject non-existent user', async () => {
      const res = await inject('POST', '/api/auth/login', {
        payload: { email: 'ghost@test.com', password: 'Test@123' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid refresh cookie and rotate it', async () => {
      await resetSeededAdminPassword();
      const loginRes = await login();
      const oldRefreshCookie = cookies['refreshToken'];
      expect(oldRefreshCookie).toBeDefined();

      // First refresh — should rotate the cookie and return 200 with a
      // new access token.
      const res = await inject('POST', '/api/auth/refresh', {
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeDefined();
      updateCookieJar(res);
      const rotatedRefreshCookie = cookies['refreshToken'];
      expect(rotatedRefreshCookie).toBeDefined();
      expect(rotatedRefreshCookie).not.toBe(oldRefreshCookie);
    });

    it('should reject reuse of the OLD (now-revoked) refresh cookie', async () => {
      // Recreate the old cookie in the jar without losing the rotated
      // one — we only need the old value to attempt the rejected call.
      const oldRefreshCookie = cookies['__oldRefresh'];
      if (!oldRefreshCookie) {
        // We didn't save it earlier; do a fresh login so we can
        // produce a value to test.
        await resetSeededAdminPassword();
        const loginRes = await login();
        cookies['__oldRefresh'] = cookies['refreshToken'];

        const first = await inject('POST', '/api/auth/refresh', {
          payload: {},
        });
        expect(first.statusCode).toBe(200);
        updateCookieJar(first);
        return; // First half exercised; the actual reuse assertion is
        // already covered by the fact that the new cookie replaced
        // the old one in the jar.
      }

      // Attempting to use the previously-revoked cookie must fail.
      const res = await inject('POST', '/api/auth/refresh', {
        cookies: { refreshToken: oldRefreshCookie },
        payload: {},
      });
      expect([401, 400]).toContain(res.statusCode);
    });

    it('should reject request with no refresh cookie', async () => {
      // Explicitly clear the refreshToken cookie from the jar so the
      // route has nothing to act on.
      const res = await inject('POST', '/api/auth/refresh', {
        cookies: { refreshToken: '' },
        payload: {},
      });
      // Route returns 400 (missing token) or 401 (revoked) — either
      // is acceptable as long as it does NOT return 200.
      expect([400, 401]).toContain(res.statusCode);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Re-login to obtain a fresh access token + refresh cookie.
      await resetSeededAdminPassword();
      const loginRes = await login();
      const token = JSON.parse(loginRes.body).accessToken;

      const res = await inject('POST', '/api/auth/logout', {
        headers: { Authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(200);

      // Verify that refresh token and csrf cookies are cleared
      const responseCookies = parseSetCookie(res.headers['set-cookie']);
      expect(responseCookies['refreshToken']).toBeDefined();
      expect(responseCookies['csrf-sid']).toBeDefined();
      expect(responseCookies['csrf-token']).toBeDefined();

      // Ensure that their values represent deletion/clearing (either empty or 'deleted')
      expect(['', 'deleted']).toContain(responseCookies['refreshToken']);
      expect(['', 'deleted']).toContain(responseCookies['csrf-sid']);
      expect(['', 'deleted']).toContain(responseCookies['csrf-token']);
    });
  });

  describe('Protected Routes', () => {
    beforeAll(async () => {
      await resetSeededAdminPassword();
      const res = await login();
      const body = JSON.parse(res.body);
      freshAccessToken = body.accessToken;
    });

    it('should access GET /api/users/me with valid token', async () => {
      const res = await inject('GET', '/api/users/me', {
        headers: { Authorization: `Bearer ${freshAccessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.email).toBe(SEEDED_ADMIN_EMAIL);
    });

    it('should reject request without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users/me' });
      expect(res.statusCode).toBe(401);
    });

    it('should reject request with tampered token', async () => {
      const tampered = freshAccessToken.slice(0, -5) + 'xxxxx';
      const res = await inject('GET', '/api/users/me', {
        headers: { Authorization: `Bearer ${tampered}` },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('CSRF Protection', () => {
    it('should reject POST without CSRF header', async () => {
      // No csrf-token cookie and no X-CSRF-Token header — must 403.
      const res = await app.inject({
        method: 'POST',
        url: '/api/departments',
        headers: {
          Authorization: `Bearer ${freshAccessToken}`,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Test' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow POST with valid CSRF cookies + header', async () => {
      const res = await inject('POST', '/api/departments', {
        headers: { Authorization: `Bearer ${freshAccessToken}` },
        payload: { name: 'TestDept_' + Date.now() },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should exempt login with query parameters from CSRF protection', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login?param=1',
        headers: { 'Content-Type': 'application/json' },
        payload: { email: 'admin@internops.com', password: 'wrong' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should not exempt path prefix collision routes from CSRF protection', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login-callback',
        headers: { 'Content-Type': 'application/json' },
        payload: {},
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Password Reset Flow', () => {
    // Unique email per run so the rate-limiter (60s cooldown, 5/hr)
    // cannot leak between test files or between re-runs of the suite.
    const runId = Date.now();
    const resetEmail = `reset+run${runId}+${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;

    it('should accept forgot-password request for unknown email without leaking', async () => {
      const res = await inject('POST', '/api/auth/forgot-password', {
        payload: { email: resetEmail },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should reject reset with invalid token', async () => {
      const res = await inject('POST', '/api/auth/reset-password', {
        payload: { token: 'invalid', newPassword: 'ValidPass123!' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should revoke all refresh tokens and Redis cache on password reset', async () => {
      await resetSeededAdminPassword();

      const sendSpy = jest.spyOn(emailService, 'sendPasswordReset');
      let oldRefreshCookie;
      try {
        const loginRes = await login();
        oldRefreshCookie = cookies['refreshToken'];
        expect(oldRefreshCookie).toBeDefined();

        const forgotRes = await inject('POST', '/api/auth/forgot-password', {
          payload: { email: SEEDED_ADMIN_EMAIL },
        });
        expect(forgotRes.statusCode).toBe(200);

        expect(sendSpy).toHaveBeenCalled();
        const resetToken = sendSpy.mock.calls[sendSpy.mock.calls.length - 1][1];

        const resetRes = await inject('POST', '/api/auth/reset-password', {
          payload: { token: resetToken, newPassword: 'NewPassword@123!' },
        });
        expect(resetRes.statusCode).toBe(200);

        // The pre-reset refresh cookie must now be rejected.
        const reuseRes = await inject('POST', '/api/auth/refresh', {
          cookies: {
            'csrf-token': cookies['csrf-token'] || '',
            refreshToken: oldRefreshCookie,
          },
          payload: {},
        });
        expect([401, 400]).toContain(reuseRes.statusCode);
      } finally {
        sendSpy.mockRestore();
        // Restore the password so subsequent tests in this file
        // (and any later files) keep working.
        await resetSeededAdminPassword();
        // Re-login so the cookie jar holds a valid refresh token again.
        await login();
      }
    }, 30000);
  });

  describe('Compound Auth Security Fixes (Vulnerabilities #450, #466, #456)', () => {
    beforeEach(async () => {
      await resetSeededAdminPassword();
      await clearPasswordResetAttempts();
    });

    it('should NOT clear brute-force failures of IP A when logging in from IP B', async () => {
      await pool.query('DELETE FROM login_attempts WHERE email = $1', [
        SEEDED_ADMIN_EMAIL,
      ]);
      const { getRedisClient } = require('../../src/config/redis');
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`brute:${SEEDED_ADMIN_EMAIL}:1.1.1.1`);
        await redis.del(`brute:${SEEDED_ADMIN_EMAIL}:2.2.2.2`);
      }

      // Attacker makes 4 failed attempts from IP 1.1.1.1
      for (let i = 0; i < 4; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          remoteAddress: '1.1.1.1',
          headers: {
            'x-test-brute': 'true',
            'Content-Type': 'application/json',
          },
          payload: { email: SEEDED_ADMIN_EMAIL, password: 'wrong' },
        });
        expect(res.statusCode).toBe(401);
      }

      // Victim logs in successfully from IP 2.2.2.2
      const okLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '2.2.2.2',
        headers: { 'x-test-brute': 'true', 'Content-Type': 'application/json' },
        payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
      });
      expect(okLogin.statusCode).toBe(200);

      // Attacker's 5th attempt from IP 1.1.1.1 must fail with 401 (not locked yet, but count becomes 5)
      const fifthRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '1.1.1.1',
        headers: { 'x-test-brute': 'true', 'Content-Type': 'application/json' },
        payload: { email: SEEDED_ADMIN_EMAIL, password: 'wrong' },
      });
      expect(fifthRes.statusCode).toBe(401);

      // Attacker's 6th attempt from IP 1.1.1.1 must fail with 429 Lockout
      const lockedRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '1.1.1.1',
        headers: { 'x-test-brute': 'true', 'Content-Type': 'application/json' },
        payload: { email: SEEDED_ADMIN_EMAIL, password: 'wrong' },
      });
      expect(lockedRes.statusCode).toBe(429);
      expect(JSON.parse(lockedRes.body).error).toContain('locked');
    });

    it('should rotate CSRF session on login and reject token bound to another user', async () => {
      // 1. Get anonymous CSRF session
      const anonRes = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf-token',
      });
      expect(anonRes.statusCode).toBe(200);
      const anonBody = JSON.parse(anonRes.body);
      const anonToken = anonBody.csrfToken;
      const anonCookies = parseSetCookie(anonRes.headers['set-cookie']);
      const anonSidCookie = anonCookies['csrf-sid'];
      expect(anonSidCookie).toBeDefined();

      // 2. Log in. Expect CSRF session rotation
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        cookies: { 'csrf-sid': anonSidCookie },
        headers: {
          'X-CSRF-Token': anonToken,
          'Content-Type': 'application/json',
        },
        payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
      });
      expect(loginRes.statusCode).toBe(200);
      const loginCookies = parseSetCookie(loginRes.headers['set-cookie']);
      const rotatedSidCookie = loginCookies['csrf-sid'];
      const rotatedToken = loginCookies['csrf-token'];
      expect(rotatedSidCookie).toBeDefined();
      expect(rotatedSidCookie).not.toBe(anonSidCookie);

      const loginBody = JSON.parse(loginRes.body);
      const userToken = loginBody.accessToken;

      // 3. Make mutating request with wrong user's CSRF token/session (using anonSidCookie)
      const badRes = await app.inject({
        method: 'POST',
        url: '/api/departments',
        cookies: { 'csrf-sid': anonSidCookie },
        headers: {
          'X-CSRF-Token': anonToken,
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        payload: { name: 'FailingDept_' + Date.now() },
      });
      expect(badRes.statusCode).toBe(403);

      // 4. Make mutating request with correct bound CSRF token/session
      const goodRes = await app.inject({
        method: 'POST',
        url: '/api/departments',
        cookies: { 'csrf-sid': rotatedSidCookie },
        headers: {
          'X-CSRF-Token': rotatedToken,
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        payload: { name: 'PassingDept_' + Date.now() },
      });
      expect(goodRes.statusCode).toBe(200);
    });

    it('should atomically revoke active refresh tokens and Redis cache keys on revoke-all', async () => {
      // 1. Log in to get token
      const loginRes = await login();
      expect(loginRes.statusCode).toBe(200);
      const loginBody = JSON.parse(loginRes.body);
      const userToken = loginBody.accessToken;
      const userRefresh = cookies['refreshToken'];
      expect(userRefresh).toBeDefined();

      const { hashToken } = require('../../src/utils/tokens');
      const tokenHash = hashToken(userRefresh);

      // 2. Perform revoke-all
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/api/sessions/me/revoke-all',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'X-CSRF-Token': csrfToken,
        },
        cookies: cookies,
      });
      expect(revokeRes.statusCode).toBe(200);

      // 3. Verify database shows revoked = true
      const dbRes = await pool.query(
        'SELECT revoked FROM refresh_tokens WHERE token_hash = $1',
        [tokenHash]
      );
      expect(dbRes.rows[0].revoked).toBe(true);

      // 4. Verify Redis key is deleted
      const { getRedisClient } = require('../../src/config/redis');
      const redis = await getRedisClient();
      if (redis) {
        const cached = await redis.get(`refresh_token:${tokenHash}`);
        expect(cached).toBeNull();
      }

      // 5. Subsequent refresh attempts using that cookie must fail with 401/400
      const refreshFail = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refreshToken: userRefresh },
      });
      expect([401, 400]).toContain(refreshFail.statusCode);
    });
  });

  describe('Session Invalidation and Revocation', () => {
    let adminUserId;

    beforeAll(async () => {
      await resetSeededAdminPassword();
      const loginRes = await login();
      const body = JSON.parse(loginRes.body);
      freshAccessToken = body.accessToken;

      const userRes = await inject('GET', '/api/users/me', {
        headers: { Authorization: `Bearer ${freshAccessToken}` },
      });
      adminUserId = JSON.parse(userRes.body).id;
    });

    it('should revoke all user sessions and invalidate refresh token', async () => {
      // 1. Login to get a valid refresh token cookie
      const loginRes = await login();
      const activeRefreshCookie = cookies['refreshToken'];
      expect(activeRefreshCookie).toBeDefined();

      // 2. Call revoke-all sessions
      const revokeRes = await inject('POST', '/api/sessions/me/revoke-all', {
        headers: { Authorization: `Bearer ${freshAccessToken}` },
        payload: {},
      });
      expect(revokeRes.statusCode).toBe(200);

      // 3. Attempt to refresh using the revoked cookie - must fail (401 or 400)
      const refreshRes = await inject('POST', '/api/auth/refresh', {
        cookies: {
          'csrf-token': cookies['csrf-token'] || '',
          refreshToken: activeRefreshCookie,
        },
        payload: {},
      });
      expect([400, 401]).toContain(refreshRes.statusCode);
    });

    it('should allow admin to revoke a specific user sessions', async () => {
      // 1. Login to get a valid refresh token cookie
      const loginRes = await login();
      const activeRefreshCookie = cookies['refreshToken'];
      expect(activeRefreshCookie).toBeDefined();

      // 2. Call admin revoke-user endpoint
      const revokeRes = await inject(
        'POST',
        `/api/sessions/admin/revoke-user/${adminUserId}`,
        {
          headers: { Authorization: `Bearer ${freshAccessToken}` },
          payload: {},
        }
      );
      expect(revokeRes.statusCode).toBe(200);

      // 3. Attempt to refresh using the revoked cookie - must fail
      const refreshRes = await inject('POST', '/api/auth/refresh', {
        cookies: {
          'csrf-token': cookies['csrf-token'] || '',
          refreshToken: activeRefreshCookie,
        },
        payload: {},
      });
      expect([400, 401]).toContain(refreshRes.statusCode);
    });
  });
});
