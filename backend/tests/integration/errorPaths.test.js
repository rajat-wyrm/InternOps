const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const config = require('../../src/config');
const { parseSetCookie, mergeCookies } = require('./helpers');

function multipartBody(boundary, filename, content) {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        'Content-Type: image/png\r\n\r\n'
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe('API error-path integration tests', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts unauthenticated client error reports without CSRF', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/client-error',
      payload: {
        message: 'Test client error',
        stack: 'Error: Test client error',
        componentStack: 'at TestComponent',
        url: 'http://localhost:5173/dashboard',
        userAgent: 'test-agent',
        timestamp: new Date().toISOString(),
      },
    });

    expect(res.statusCode).toBe(204);
  });

  it('handles malformed CSRF cookies without server errors or delays', async () => {
    const cases = [
      'csrf-sid=abc%',
      'csrf-token=abc%',
      'csrf-sid=1%20AND%20SLEEP(5)',
      'csrf-token=1%20AND%20SLEEP(5)',
    ];

    for (const cookie of cases) {
      const startedAt = Date.now();
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/csrf-token',
        headers: { cookie },
      });
      const durationMs = Date.now() - startedAt;
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(durationMs).toBeLessThan(2000);
      expect(body.csrfToken).toEqual(expect.any(String));
      expect(body.csrfToken).not.toHaveLength(0);
      expect(res.body).not.toMatch(
        /stack|sql|select|sleep\s*\(|node_modules|internal server error/i
      );
    }
  });
  it('returns a sanitized 500 when a database operation fails', async () => {
    const dbError = new Error('database connection refused');
    const query = jest.spyOn(pool, 'query').mockRejectedValueOnce(dbError);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@internops.com', password: 'Admin@123' },
    });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      success: false,
      message: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      details: [],
    });
    expect(res.body).not.toContain(dbError.message);
    expect(res.body).not.toContain('stack');
    query.mockRestore();
  });

  it('returns 400 for malformed request bodies without exposing internals', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'not-an-email', password: 'short' },
    });

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Validation failed');
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toEqual(expect.any(Array));
    expect(res.body).not.toContain('stack');
  });

  it('rejects expired and malformed bearer tokens with 401', async () => {
    const expiredToken = jwt.sign(
      {
        id: '00000000-0000-4000-8000-000000000001',
        role: 'ADMIN',
        typ: 'access',
      },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: -1 }
    );

    for (const token of [expiredToken, 'not.a.jwt']) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toEqual({ error: 'Invalid token' });
    }
  });

  it('returns 413 when an avatar upload exceeds the configured file limit', async () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    const token = jwt.sign(
      { id: userId, role: 'ADMIN', typ: 'access', jti: 'error-path-upload' },
      config.jwt.secret,
      { algorithm: 'HS256', expiresIn: '5m' }
    );
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf-token',
      headers: { authorization: `Bearer ${token}` },
    });
    const csrfToken = JSON.parse(csrfRes.body).csrfToken;
    const cookies = mergeCookies(
      {},
      parseSetCookie(csrfRes.headers['set-cookie'])
    );
    const boundary = 'error-path-upload-boundary';
    const pngWithOversizePayload = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(config.maxFileSize),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/uploads/avatar',
      cookies,
      headers: {
        authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody(boundary, 'too-large.png', pngWithOversizePayload),
    });

    expect(res.statusCode).toBe(413);
    const body = JSON.parse(res.body);

    expect(body.success).toBe(false);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.message).toMatch(/file.*(size|large)|maximum/i);
    expect(body.details).toEqual([]);
  });
});

describe('Redis unavailability fallback', () => {
  it('uses PostgreSQL revocation when Redis is unavailable', async () => {
    const repository = require('../../src/modules/auth/repository');
    const { getRedisClient } = require('../../src/config/redis');
    const jti = `revocation-fallback-${Date.now()}`;
    const user = await pool.query(
      `SELECT id FROM users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`
    );
    const userId = user.rows[0].id;
    const expiresAt = new Date(Date.now() + 60_000);

    await expect(getRedisClient()).resolves.toBeNull();

    try {
      await repository.revokeAccessToken(jti, userId, expiresAt);
      await expect(repository.isAccessTokenRevoked(jti)).resolves.toBe(true);
      await expect(
        repository.isAccessTokenRevoked(`${jti}-not-revoked`)
      ).resolves.toBe(false);
    } finally {
      await pool.query('DELETE FROM revoked_access_tokens WHERE jti = $1', [
        jti,
      ]);
    }
  });
});
