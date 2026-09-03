const fs = require('fs');
const path = require('path');
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

  it('returns a sanitized 500 when a database operation fails', async () => {
    const dbError = new Error('database connection refused');
    const query = jest.spyOn(pool, 'query').mockRejectedValueOnce(dbError);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@internops.com', password: 'Admin@123' },
    });

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(500);
    expect(body).toEqual({
      error: 'Internal Server Error',
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      requestId: expect.any(String),
    });
    expect(body.requestId).not.toHaveLength(0);
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
    const { rows } = await pool.query(
      `SELECT id FROM users
       WHERE role = 'ADMIN' AND suspended = FALSE AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`
    );
    const userId = rows[0].id;
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
        origin: 'http://localhost:5173',
      },
      payload: multipartBody(boundary, 'too-large.png', pngWithOversizePayload),
    });

    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body).error).toMatch(/file.*(size|large)|maximum/i);
  });

  it('removes the current avatar and deletes its stored file', async () => {
    const { rows } = await pool.query(
      `SELECT id, avatar_url FROM users
       WHERE role = 'ADMIN' AND suspended = FALSE AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`
    );

    const userId = rows[0].id;
    const originalAvatarUrl = rows[0].avatar_url;
    const fileName = `avatar_remove_test_${Date.now()}.png`;
    const avatarUrl = `/uploads/${fileName}`;
    const filePath = path.resolve(
      __dirname,
      '..',
      '..',
      config.uploadDir,
      fileName
    );

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from('test avatar'));
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
      avatarUrl,
      userId,
    ]);

    try {
      const token = jwt.sign(
        {
          id: userId,
          role: 'ADMIN',
          typ: 'access',
          jti: 'remove-avatar-test',
        },
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

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/uploads/avatar',
        cookies,
        headers: {
          authorization: `Bearer ${token}`,
          'x-csrf-token': csrfToken,
          origin: 'http://localhost:5173',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        success: true,
        avatar_url: null,
      });

      const updated = await pool.query(
        'SELECT avatar_url FROM users WHERE id = $1',
        [userId]
      );

      expect(updated.rows[0].avatar_url).toBeNull();
      expect(fs.existsSync(filePath)).toBe(false);
    } finally {
      await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [
        originalAvatarUrl,
        userId,
      ]);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
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
