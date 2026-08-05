const http = require('http');
const app = require('../../src/app');

describe('Health Check Integration Tests', () => {
  let serverUrl;

  beforeAll(async () => {
    jest.setTimeout(30000);
    const { initializeWebSocket } = require('../../src/websocket');
    // Start listening on an ephemeral port so we can test socket.io
    // handshake HTTP handlers (which bypass fastify route routing).
    serverUrl = await app.listen({ port: 0 });
    initializeWebSocket(app.server, app.log);
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

  describe('GET /health/full', () => {
    it('should return health status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/full',
      });

      expect([200, 503]).toContain(res.statusCode);
    });
  });

  describe('WebSocket Handshake Authentication', () => {
    it('should reject handshake with invalid token', (done) => {
      http
        .get(
          `${serverUrl}/socket.io/?EIO=4&transport=polling&token=invalid_token`,
          (res) => {
            expect(res.statusCode).toBe(403);
            done();
          }
        )
        .on('error', (err) => {
          done(err);
        });
    });
  });

  describe('WebSocket Handshake Authentication', () => {
    it('should reject handshake with invalid token', (done) => {
      http
        .get(
          `${serverUrl}/socket.io/?EIO=4&transport=polling&token=invalid_token`,
          (res) => {
            expect(res.statusCode).toBe(403);
            done();
          }
        )
        .on('error', (err) => {
          done(err);
        });
    });
  });
});
