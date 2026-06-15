const app = require('../../src/app');

describe('Health Check Integration Tests', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });
      // status code can be 200 or 503 depending on Redis status
      expect([200, 503]).toContain(res.statusCode);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('status');
    });
  });

  describe('GET /health/db', () => {
    it('should return database connection status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/db',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual({
        status: 'ok',
        db: 'connected',
      });
    });
  });

  describe('GET /health/full', () => {
    it('should return full system health status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/full',
      });
      expect([200, 503]).toContain(res.statusCode);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('checks');
      expect(body.checks).toHaveProperty('db');
      expect(body.checks).toHaveProperty('redis');
    });
  });
});
