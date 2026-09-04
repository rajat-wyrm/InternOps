const app = require('../../src/app');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  clearLoginAttempts,
  clearPasswordResetAttempts,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');

let cookies = {};
let csrfToken;
let accessToken;

function updateCookieJar(res) {
  const newCookies = parseSetCookie(res.headers['set-cookie']);
  mergeCookies(cookies, newCookies);
  mergeCookies(cookies, res.cookies);

  if (newCookies['csrf-token']) {
    csrfToken = newCookies['csrf-token'];
  }
}

function authHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
    'X-CSRF-Token': csrfToken,
    ...extra,
  };
}

async function inject(method, url, options = {}) {
  return app.inject({
    method,
    url,
    cookies: {
      ...cookies,
      ...(options.cookies || {}),
    },
    headers: authHeaders(options.headers),
    payload: options.payload,
  });
}

async function loginAsAdmin() {
  const res = await inject('POST', '/api/v1/auth/login', {
    payload: {
      email: SEEDED_ADMIN_EMAIL,
      password: SEEDED_ADMIN_PASSWORD,
    },
  });

  expect(res.statusCode).toBe(200);

  const body = JSON.parse(res.body);
  expect(body.accessToken).toBeDefined();

  accessToken = body.accessToken;
  updateCookieJar(res);
}

beforeAll(async () => {
  await app.ready();

  await resetSeededAdminPassword();
  await clearLoginAttempts();
  await clearPasswordResetAttempts();

  cookies = {};

  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/csrf-token',
  });

  expect(csrfRes.statusCode).toBe(200);

  const body = JSON.parse(csrfRes.body);
  csrfToken = body.csrfToken;

  updateCookieJar(csrfRes);

  await loginAsAdmin();
});

afterAll(async () => {
  await resetSeededAdminPassword();
  await app.close();
});

describe('GitHub Sync API Contract Tests', () => {
  describe('POST /api/v1/github/webhook', () => {
    test('should reject a webhook without x-github-event', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/github/webhook',
        headers: {
          'x-github-delivery': 'test-delivery',
        },
        payload: {},
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.body);

      expect(body.received).toBe(false);
      expect(body.error).toBe('Missing x-github-event header');
    });

    test('should reject a webhook without x-github-delivery', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/github/webhook',
        headers: {
          'x-github-event': 'issues',
        },
        payload: {},
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.body);

      expect(body.received).toBe(false);
      expect(body.error).toBe('Missing x-github-delivery header');
    });

    test('should reject a webhook with an empty body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/github/webhook',
        headers: {
          'x-github-event': 'issues',
          'x-github-delivery': 'test-delivery',
        },
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.body);

      expect(body.received).toBe(false);
      expect(body.error).toBe('Empty request body');
    });

    test('should reject a webhook with an invalid signature', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/github/webhook',
        headers: {
          'content-type': 'application/json',
          'x-github-event': 'issues',
          'x-github-delivery': 'test-delivery',
          'x-hub-signature-256': 'sha256-invalid',
        },
        payload: {
          action: 'opened',
          repository: {
            full_name: 'test/repository',
          },
        },
      });

      expect(res.statusCode).toBe(401);

      const body = JSON.parse(res.body);

      expect(body.received).toBe(false);
      expect(body.error).toBe('Invalid webhook signature');
    });
  });

  describe('Authentication protection', () => {
    test('should reject unauthenticated access to GitHub sync status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/github/status',
      });

      expect([401, 403]).toContain(res.statusCode);
    });

    test('should reject unauthenticated access to GitHub settings', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/github/settings',
      });

      expect([401, 403]).toContain(res.statusCode);
    });

    test('should reject unauthenticated GitHub sync requests', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/github/sync',
        payload: {},
      });

      expect([401, 403]).toContain(res.statusCode);
    });
  });

  describe('GET /api/v1/github/status', () => {
    test('should return GitHub sync status for an admin', async () => {
      const res = await inject('GET', '/api/v1/github/status', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body).toHaveProperty('configured');
      expect(body).toHaveProperty('repo');
      expect(body).toHaveProperty('webhookSecretConfigured');
      expect(body).toHaveProperty('githubTokenConfigured');
      expect(body).toHaveProperty('totalSynced');
      expect(body).toHaveProperty('successfulEvents');
      expect(body).toHaveProperty('failedEvents');
      expect(body).toHaveProperty('skippedEvents');
      expect(body.webhookEndpoint).toBe('/api/v1/github/webhook');
      expect(body).toHaveProperty('recentLogs');
    });
  });

  describe('GET /api/v1/github/settings', () => {
    test('should return the GitHub sync settings contract', async () => {
      const res = await inject('GET', '/api/v1/github/settings', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body).toHaveProperty('configured');

      if (body.configured === false) {
        expect(body).toHaveProperty('repo');
        expect(body).toHaveProperty('isActive');
      } else {
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('repo');
        expect(body).toHaveProperty('isActive');
      }
    });
  });

  describe('PUT /api/v1/github/settings', () => {
    test('should reject invalid settings data', async () => {
      const res = await inject('PUT', '/api/v1/github/settings', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        payload: {
          repo: '',
        },
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.body);

      expect(body.error).toBe('Validation failed');
      expect(Array.isArray(body.details)).toBe(true);
    });
  });

  describe('POST /api/v1/github/webhook/unregister', () => {
    test('should require hookId', async () => {
      const res = await inject('POST', '/api/v1/github/webhook/unregister', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.body);

      expect(body.error).toBe('hookId is required');
    });
  });

  describe('POST /api/v1/github/sync-task/batch', () => {
    test('should reject an empty taskIds array', async () => {
      const res = await inject('POST', '/api/v1/github/sync-task/batch', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        payload: {
          taskIds: [],
        },
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.body);

      expect(body.error).toBe('Validation failed');
    });

    test('should reject a missing taskIds field', async () => {
      const res = await inject('POST', '/api/v1/github/sync-task/batch', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.body);

      expect(body.error).toBe('Validation failed');
    });
  });

  describe('Task ID validation', () => {
    test('should reject an invalid task UUID', async () => {
      const res = await inject('POST', '/api/v1/github/sync-task/not-a-uuid', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    test('should reject an invalid UUID when closing a task', async () => {
      const res = await inject(
        'POST',
        '/api/v1/github/sync-task/not-a-uuid/close',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          payload: {},
        }
      );

      expect(res.statusCode).toBe(400);
    });

    test('should reject an invalid UUID when reopening a task', async () => {
      const res = await inject(
        'POST',
        '/api/v1/github/sync-task/not-a-uuid/reopen',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          payload: {},
        }
      );

      expect(res.statusCode).toBe(400);
    });
  });
});
