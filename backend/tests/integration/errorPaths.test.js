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

  it('returns a sanitized 500 when a database operation fails', async () => {
    const dbError = new Error('database connection refused');
    const query = jest.spyOn(pool, 'query').mockRejectedValueOnce(dbError);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@internops.com', password: 'Admin@123' },
    });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Internal Server Error' });
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
    expect(body.error).toBe('Validation error');
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
    expect(JSON.parse(res.body).error).toMatch(/file.*(size|large)|maximum/i);
  });
});

describe('Redis unavailability fallback', () => {
  it('continues token checks when Redis is unavailable', async () => {
    const {
      getRedisClient,
      isAccessTokenBlacklisted,
      blacklistAccessToken,
    } = require('../../src/config/redis');

    // Test mode intentionally makes the Redis client unavailable. The
    // application must treat that the same as a failed optional connection.
    await expect(getRedisClient()).resolves.toBeNull();
    await expect(isAccessTokenBlacklisted('token-id')).resolves.toBe(false);
    await expect(blacklistAccessToken('token-id', 60)).resolves.toBeUndefined();
  });
});
