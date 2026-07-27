const app = require('../../src/app');

describe('Health Check Integration Tests', () => {
  beforeAll(async () => {
    jest.setTimeout(30000);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should always return 200 in test mode (Redis is disabled)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);
      expect(body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/detailed', () => {
    it('should require authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect([401, 403]).toContain(res.statusCode);
    });
  });
});
