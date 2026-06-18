const supertest = require('supertest');
const app = require('../../src/app');
const emailService = require('../../src/services/email');
let csrfToken, csrfCookieValue, accessToken, refreshToken, freshAccessToken;

beforeAll(async () => {
  await app.ready();

  // Restore admin password to Admin@123 in case a previous run left it modified
  const argon2 = require('argon2');
  const pool = require('../../src/config/db');
  const restoreHash = await argon2.hash('Admin@123');
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
    restoreHash,
    'admin@internops.com',
  ]);

  // Get CSRF token (body + cookie for Double Submit pattern)
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
  });
  const body = JSON.parse(csrfRes.body);
  csrfToken = body.csrfToken;
  const cookies = csrfRes.cookies;
  const csrfCookie = cookies.find((c) => c.name === 'csrf-token');
  csrfCookieValue = csrfCookie ? csrfCookie.value : csrfToken;
});

afterAll(async () => {
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
    cookies: { 'csrf-token': csrfCookieValue, ...opts.cookies },
    headers: authHeaders(opts.headers),
    payload: opts.payload,
  });
}

describe('Auth Integration Tests', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await inject('POST', '/api/auth/login', {
        payload: { email: 'admin@internops.com', password: 'Admin@123' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('should reject invalid password', async () => {
      const res = await inject('POST', '/api/auth/login', {
        payload: { email: 'admin@internops.com', password: 'wrong' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject missing email', async () => {
      const res = await inject('POST', '/api/auth/login', {
        payload: { password: 'Admin@123' },
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
    it('should refresh token with valid refresh token', async () => {
      const res = await inject('POST', '/api/auth/refresh', {
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeDefined();
    });

    it('should reject reuse of old refresh token', async () => {
      const res = await inject('POST', '/api/auth/refresh', {
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject invalid refresh token', async () => {
      const res = await inject('POST', '/api/auth/refresh', {
        payload: { refreshToken: 'invalid.token.here' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await inject('POST', '/api/auth/logout', {
        headers: { Authorization: `Bearer ${accessToken}` },
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Protected Routes', () => {
    beforeAll(async () => {
      const res = await inject('POST', '/api/auth/login', {
        payload: { email: 'admin@internops.com', password: 'Admin@123' },
      });
      const body = JSON.parse(res.body);
      freshAccessToken = body.accessToken;
    });

    it('should access GET /api/users/me with valid token', async () => {
      const res = await inject('GET', '/api/users/me', {
        headers: { Authorization: `Bearer ${freshAccessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.email).toBe('admin@internops.com');
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
      const res = await app.inject({
        method: 'POST',
        url: '/api/departments',
        cookies: { 'csrf-token': csrfCookieValue },
        headers: {
          Authorization: `Bearer ${freshAccessToken}`,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Test' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow POST with CSRF token', async () => {
      const res = await inject('POST', '/api/departments', {
        headers: { Authorization: `Bearer ${freshAccessToken}` },
        payload: { name: 'TestDept_' + Date.now() },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Password Reset Flow', () => {
    it('should accept forgot-password request', async () => {
      const res = await inject('POST', '/api/auth/forgot-password', {
        payload: { email: 'admin@internops.com' },
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
      const loginRes = await inject('POST', '/api/auth/login', {
        payload: { email: 'admin@internops.com', password: 'Admin@123' },
      });
      expect(loginRes.statusCode).toBe(200);
      const oldRefreshToken = JSON.parse(loginRes.body).refreshToken;

      const sendSpy = jest.spyOn(emailService, 'sendPasswordReset');
      try {
        const forgotRes = await inject('POST', '/api/auth/forgot-password', {
          payload: { email: 'admin@internops.com' },
        });
        expect(forgotRes.statusCode).toBe(200);

        expect(sendSpy).toHaveBeenCalled();
        const resetToken = sendSpy.mock.calls[0][1];

        const resetRes = await inject('POST', '/api/auth/reset-password', {
          payload: { token: resetToken, newPassword: 'NewPassword@123!' },
        });
        expect(resetRes.statusCode).toBe(200);

        const reuseTokenRes = await inject('POST', '/api/auth/refresh', {
          payload: { refreshToken: oldRefreshToken },
        });
        expect([401, 400]).toContain(reuseTokenRes.statusCode);
      } finally {
        sendSpy.mockRestore();
        const argon2 = require('argon2');
        const pool = require('../../src/config/db');
        const restoreHash = await argon2.hash('Admin@123');
        await pool.query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [restoreHash, 'admin@internops.com']
        );
      }
    });
  });
});
