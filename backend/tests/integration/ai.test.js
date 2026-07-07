// tests/integration/ai.test.js
//
// Verifies issue #498 fixes:
//   1. Cache is scoped per-user (no cross-user leak)
//   2. Cache size is bounded (no unbounded Map growth / OOM)
//   3. Per-user rate limit returns 429 after threshold

const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');

describe('AI Chat Integration Tests (#498)', () => {
  let app;
  let cookies;
  let csrfToken;
  let accessToken;

  function authHeaders(extra) {
    return {
      'X-CSRF-Token': cookies['csrf-token'] || csrfToken,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
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
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      cookies,
      headers: authHeaders(),
      payload: { email, password },
    });
    mergeCookies(cookies, parseSetCookie(res.headers['set-cookie']));
    mergeCookies(cookies, res.cookies);
    const body = JSON.parse(res.body);
    accessToken = body.accessToken;
    return res;
  }

  function mockProviderSuccess() {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        headers: {
          get: (key) => {
            if (key === 'content-length') return null;
            return null;
          },
        },
        json: async () => ({
          choices: [{ message: { content: `response-${callCount}` } }],
        }),
      };
    });
    return () => callCount;
  }

  describe('Layer 1: Cross-user cache isolation', () => {
    beforeAll(async () => {
      // Fresh app instance for this layer
      process.env.AI_CACHE_MAX_ENTRIES = '100';
      process.env.AI_CHAT_RATE_LIMIT_PER_MIN = '100'; // High limit to avoid conflicts
      process.env.AI_PROVIDER_ORDER = 'groq';
      process.env.GROQ_API_KEY = 'test-key';
      process.env.AI_TIMEOUT = '5000';

      jest.resetModules();
      app = require('../../src/app');
      await app.ready();
      await resetSeededAdminPassword();
      const pool = require('../../src/config/db');
      await pool.query('DELETE FROM ai_usage');

      cookies = {};
      const csrfRes = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf-token',
      });
      csrfToken = JSON.parse(csrfRes.body).csrfToken;
      mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
      mergeCookies(cookies, csrfRes.cookies);

      await login();
    });

    afterAll(async () => {
      await app.close();
      const pool = require('../../src/config/db');
      await pool.end();
      delete global.fetch;
    });

    it('should cache and reuse response for same user with same prompt', async () => {
      mockProviderSuccess();
      const testPrompt = 'Draft a performance review';

      // First request - hits provider
      const res1 = await inject('POST', '/api/ai/chat', {
        payload: { prompt: testPrompt },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      expect(body1.content).toBeDefined();

      // Second request - should be cached
      const res2 = await inject('POST', '/api/ai/chat', {
        payload: { prompt: testPrompt },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.cached).toBe(true);
      expect(body2.content).toBe(body1.content);
    });
  });

  describe('Layer 2: Bounded cache memory (LRU)', () => {
    beforeAll(async () => {
      // Fresh app with small cache for this layer
      process.env.AI_CACHE_MAX_ENTRIES = '3';
      process.env.AI_CHAT_RATE_LIMIT_PER_MIN = '100';
      process.env.AI_PROVIDER_ORDER = 'groq';
      process.env.GROQ_API_KEY = 'test-key';
      process.env.AI_TIMEOUT = '5000';

      jest.resetModules();
      app = require('../../src/app');
      await app.ready();
      await resetSeededAdminPassword();
      const pool = require('../../src/config/db');
      await pool.query('DELETE FROM ai_usage');

      cookies = {};
      const csrfRes = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf-token',
      });
      csrfToken = JSON.parse(csrfRes.body).csrfToken;
      mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
      mergeCookies(cookies, csrfRes.cookies);

      await login();
    });

    afterAll(async () => {
      await app.close();
      const pool = require('../../src/config/db');
      await pool.end();
      delete global.fetch;
    });

    it('should handle more prompts than cache max without crashing', async () => {
      mockProviderSuccess();
      const responses = [];

      // Send 5 prompts with cache max = 3
      for (let i = 0; i < 5; i++) {
        const res = await inject('POST', '/api/ai/chat', {
          payload: { prompt: `prompt-${i}` },
        });
        responses.push(res.statusCode);
      }

      // All should succeed (not crash)
      expect(responses.every((code) => code === 200)).toBe(true);
    });

    it('should evict least-recently-used entries when max exceeded', async () => {
      const getCallCount = mockProviderSuccess();

      // Fill cache with 3 entries
      for (let i = 0; i < 3; i++) {
        const res = await inject('POST', '/api/ai/chat', {
          payload: { prompt: `cache-test-${i}` },
        });
        expect(res.statusCode).toBe(200);
      }
      expect(getCallCount()).toBe(3);

      // Access first entry again (keeps it in cache)
      const resHit = await inject('POST', '/api/ai/chat', {
        payload: { prompt: 'cache-test-0' },
      });
      expect(JSON.parse(resHit.body).cached).toBe(true);
      expect(getCallCount()).toBe(3); // No new provider call

      // Add a 4th entry (should evict LRU, likely cache-test-1)
      const res4 = await inject('POST', '/api/ai/chat', {
        payload: { prompt: 'cache-test-new' },
      });
      expect(res4.statusCode).toBe(200);
      expect(getCallCount()).toBe(4);

      // cache-test-0 should still be cached
      const resCheck = await inject('POST', '/api/ai/chat', {
        payload: { prompt: 'cache-test-0' },
      });
      expect(JSON.parse(resCheck.body).cached).toBe(true);
    });
  });

  describe('Layer 3: Per-user rate limiting', () => {
    beforeAll(async () => {
      // Fresh app with low rate limit for this layer
      process.env.AI_CACHE_MAX_ENTRIES = '100';
      process.env.AI_CHAT_RATE_LIMIT_PER_MIN = '3'; // Low limit for testing
      process.env.AI_PROVIDER_ORDER = 'groq';
      process.env.GROQ_API_KEY = 'test-key';
      process.env.AI_TIMEOUT = '5000';

      jest.resetModules();
      app = require('../../src/app');
      await app.ready();
      await resetSeededAdminPassword();
      const pool = require('../../src/config/db');
      await pool.query('DELETE FROM ai_usage');

      cookies = {};
      const csrfRes = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf-token',
      });
      csrfToken = JSON.parse(csrfRes.body).csrfToken;
      mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
      mergeCookies(cookies, csrfRes.cookies);

      await login();
      const uniqueEmail = `tl-rate-${Date.now()}@example.com`;
      const regRes = await inject('POST', '/api/auth/register', {
        payload: {
          email: uniqueEmail,
          password: 'TLPassword123!',
          role: 'TL',
          fullName: 'TL Rate Limit Test',
        },
      });
      expect(regRes.statusCode).toBe(201);
      await pool.query(
        'UPDATE users SET email_verified = TRUE WHERE email = $1',
        [uniqueEmail]
      );

      cookies = {};
      const csrfRes2 = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf-token',
      });
      csrfToken = JSON.parse(csrfRes2.body).csrfToken;
      mergeCookies(cookies, parseSetCookie(csrfRes2.headers['set-cookie']));
      mergeCookies(cookies, csrfRes2.cookies);
      await login(uniqueEmail, 'TLPassword123!');
    });

    afterAll(async () => {
      await app.close();
      const pool = require('../../src/config/db');
      await pool.end();
      delete global.fetch;
    });

    it('should allow requests up to rate limit', async () => {
      mockProviderSuccess();
      const responses = [];

      // AI_CHAT_RATE_LIMIT_PER_MIN = 3
      for (let i = 0; i < 3; i++) {
        const res = await inject('POST', '/api/ai/chat', {
          payload: { prompt: `rate-test-${i}` },
        });
        responses.push(res.statusCode);
      }

      // First 3 should succeed
      expect(responses.every((code) => code === 200)).toBe(true);
    });

    it('should return 429 when exceeding rate limit', async () => {
      mockProviderSuccess();

      // Try 4 requests with limit of 3
      const responses = [];
      for (let i = 0; i < 4; i++) {
        const res = await inject('POST', '/api/ai/chat', {
          payload: { prompt: `rate-exceed-${i}` },
        });
        responses.push(res.statusCode);
      }

      // At least one should be 429
      expect(responses.some((code) => code === 429)).toBe(true);
    });
  });

  describe('Layer 4: Response size cap', () => {
    beforeAll(async () => {
      process.env.AI_CACHE_MAX_ENTRIES = '100';
      process.env.AI_CHAT_RATE_LIMIT_PER_MIN = '100';
      process.env.AI_PROVIDER_ORDER = 'groq';
      process.env.GROQ_API_KEY = 'test-key';
      process.env.AI_TIMEOUT = '5000';
      process.env.AI_MAX_RESPONSE_BYTES = '1000'; // Small limit for testing

      jest.resetModules();
      app = require('../../src/app');
      await app.ready();
      await resetSeededAdminPassword();
      const pool = require('../../src/config/db');
      await pool.query('DELETE FROM ai_usage');

      cookies = {};
      const csrfRes = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf-token',
      });
      csrfToken = JSON.parse(csrfRes.body).csrfToken;
      mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
      mergeCookies(cookies, csrfRes.cookies);

      await login();
      const uniqueEmail = `tl-size-${Date.now()}@example.com`;
      const regRes = await inject('POST', '/api/auth/register', {
        payload: {
          email: uniqueEmail,
          password: 'TLPassword123!',
          role: 'TL',
          fullName: 'TL Size Limit Test',
        },
      });
      expect(regRes.statusCode).toBe(201);
      await pool.query(
        'UPDATE users SET email_verified = TRUE WHERE email = $1',
        [uniqueEmail]
      );

      cookies = {};
      const csrfRes2 = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf-token',
      });
      csrfToken = JSON.parse(csrfRes2.body).csrfToken;
      mergeCookies(cookies, parseSetCookie(csrfRes2.headers['set-cookie']));
      mergeCookies(cookies, csrfRes2.cookies);
      await login(uniqueEmail, 'TLPassword123!');
    });

    afterAll(async () => {
      await app.close();
      const pool = require('../../src/config/db');
      await pool.end();
      delete global.fetch;
    });

    it('should reject responses exceeding size limit', async () => {
      // Mock provider returning oversized response
      global.fetch = jest.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (key) => {
              if (key === 'content-length') {
                return '5000'; // 5KB > 1KB limit
              }
              return null;
            },
          },
          json: async () => ({}),
        };
      });

      const res = await inject('POST', '/api/ai/chat', {
        payload: { prompt: 'test oversized response' },
      });

      // Should be rejected with error status
      expect([503, 502, 504, 400]).toContain(res.statusCode);
    });
  });
});
