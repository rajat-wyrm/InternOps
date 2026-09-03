const app = require('../../src/app');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');

describe('Reports Integration Tests — date range validation', () => {
  let adminToken;
  let adminCsrfToken;
  let adminCookies = {};

  beforeAll(async () => {
    await app.ready();
    await resetSeededAdminPassword();

    // Login Admin
    const adminCsrfRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf-token',
    });
    adminCsrfToken = JSON.parse(adminCsrfRes.body).csrfToken;
    mergeCookies(
      adminCookies,
      parseSetCookie(adminCsrfRes.headers['set-cookie'])
    );
    mergeCookies(adminCookies, adminCsrfRes.cookies);

    const adminLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      cookies: adminCookies,
      headers: {
        'X-CSRF-Token': adminCsrfToken,
        'Content-Type': 'application/json',
      },
      payload: {
        email: SEEDED_ADMIN_EMAIL,
        password: SEEDED_ADMIN_PASSWORD,
      },
    });
    adminToken = JSON.parse(adminLoginRes.body).accessToken;
    mergeCookies(
      adminCookies,
      parseSetCookie(adminLoginRes.headers['set-cookie'])
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/reports/attendance-summary — from/to validation', () => {
    it('should reject a from date that is after the to date', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/attendance-summary?from=2026-08-27&to=2026-08-20',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/from.*must be on or before.*to/i);
    });

    it('should accept a valid range where from is before to', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/attendance-summary?from=2026-08-01&to=2026-08-27',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should accept a range where from equals to', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/attendance-summary?from=2026-08-27&to=2026-08-27',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/reports/ratings-summary — from/to validation', () => {
    it('should reject a from date that is after the to date', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/ratings-summary?from=2026-08-27&to=2026-08-20',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/from.*must be on or before.*to/i);
    });
  });

  describe('GET /api/v1/reports/department-attendance — optional from/to validation', () => {
    it('should reject an inverted range when both dates are provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/department-attendance?from=2026-08-27&to=2026-08-20',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should allow the request when only one of from/to is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/department-attendance?from=2026-08-01',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
