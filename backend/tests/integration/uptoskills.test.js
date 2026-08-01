const app = require('../../src/app');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');
const { generateAccessToken } = require('../../src/utils/tokens');

describe('UptoSkills Integration Tests', () => {
  let csrfToken;
  let cookies;
  let accessToken;

  beforeAll(async () => {
    await app.ready();
    await resetSeededAdminPassword();

    // Fetch initial CSRF token (pre-login)
    cookies = {};
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf-token',
      cookies,
    });
    csrfToken = JSON.parse(csrfRes.body).csrfToken;
    mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
    mergeCookies(cookies, csrfRes.cookies);

    // Login as the seeded admin
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      cookies,
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      payload: { email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD },
    });
    if (loginRes.statusCode !== 200) {
      throw new Error(
        `Admin login failed (${loginRes.statusCode}): ${loginRes.body}`
      );
    }
    accessToken = JSON.parse(loginRes.body).accessToken;
    mergeCookies(cookies, parseSetCookie(loginRes.headers['set-cookie']));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/uptoskills/sync-status', () => {
    it('should require authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/uptoskills/sync-status',
      });
      expect([401, 403]).toContain(res.statusCode);
    });

    it('should forbid authenticated non-admin users', async () => {
      const internToken = generateAccessToken({
        id: '00000000-0000-4000-8000-000000000002',
        role: 'INTERN',
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/uptoskills/sync-status',
        headers: { Authorization: `Bearer ${internToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: 'Forbidden' });
    });

    it('should return 501 Not Implemented', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/uptoskills/sync-status',
        cookies,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(res.statusCode).toBe(501);
      const body = JSON.parse(res.body);
      expect(body).toEqual({
        error: 'Not Implemented',
        message: 'UptoSkills synchronization integration is not implemented.',
      });
    });
  });
});
