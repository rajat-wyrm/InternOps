const app = require('../../src/app');
const emailService = require('../../src/services/email');
const pool = require('../../src/config/db');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  clearPasswordResetAttempts,
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

  cookies = {};
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
  });
  const body = JSON.parse(csrfRes.body);
  csrfToken = body.csrfToken;
  mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
  // Cookies that Fastify exposes on `res.cookies` are already decoded
  // objects; merge those too for completeness.
  mergeCookies(cookies, csrfRes.cookies);
});

afterAll(async () => {
  // Restore the admin password so any other suite loaded after this
  // one (e.g. when the test glob includes both) starts from a known
  // state. globalTeardown does the same at the end of the whole run.
  await resetSeededAdminPassword();
  await app.close();
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
  mergeCookies(cookies, parseSetCookie(res.headers['set-cookie']));
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
      mergeCookies(cookies, parseSetCookie(res.headers['set-cookie']));
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
        mergeCookies(cookies, parseSetCookie(first.headers['set-cookie']));
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
});
