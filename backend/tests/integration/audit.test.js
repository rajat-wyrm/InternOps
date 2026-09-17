const app = require('../../src/app');
const pool = require('../../src/config/db');
console.log(process.env.SEED_ADMIN_EMAIL);
const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');

describe('Audit Integration Tests', () => {
  let adminToken;
  let adminCsrfToken;
  let adminCookies = {};

  let internToken;
  let internCsrfToken;
  let internCookies = {};

  const internId = uuidv4();
  const internEmail = `intern-${internId}@example.com`;
  const internPassword = 'InternPassword123!';

  let adminUserId;

  // Track seeded log IDs so tests can find the exact rows they care about
  const seededAdminLogId = uuidv4();
  const seededInternLogId = uuidv4();
  const seededSystemLogId = uuidv4();

  beforeAll(async () => {
    jest.setTimeout(60000);
    await app.ready();
    await resetSeededAdminPassword();

    // Find admin user ID
    const adminUserRes = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [SEEDED_ADMIN_EMAIL]
    );
    console.log('SEEDED_ADMIN_EMAIL =', SEEDED_ADMIN_EMAIL);
    console.log('ROWS =', adminUserRes.rows);
    adminUserId = adminUserRes.rows[0].id;

    // Create Intern User in database
    const internHash = await argon2.hash(internPassword);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, 'INTERN', 'Test Intern')`,
      [internId, internEmail, internHash]
    );

    // Insert mock audit logs with known IDs so tests can find exact rows
    // Use a unique action prefix 'AUDIT_TEST_' to distinguish from real login logs
    await pool.query(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        seededAdminLogId,
        adminUserId,
        'AUDIT_TEST_LOGIN',
        'auth',
        adminUserId,
        '192.168.1.1',
        'Mozilla/5.0',
        JSON.stringify({ seeded: true }),
      ]
    );

    await pool.query(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        seededInternLogId,
        internId,
        'AUDIT_TEST_LOGIN',
        'auth',
        internId,
        '10.0.0.1',
        'Chrome/100',
        JSON.stringify({ seeded: true }),
      ]
    );

    await pool.query(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        seededSystemLogId,
        null,
        'AUDIT_TEST_SYSTEM_UPDATE',
        'system',
        null,
        '127.0.0.1',
        'InternOpsCron',
        JSON.stringify({ seeded: true }),
      ]
    );

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

    // Login Intern
    const internCsrfRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf-token',
    });

    internCsrfToken = JSON.parse(internCsrfRes.body).csrfToken;

    mergeCookies(
      internCookies,
      parseSetCookie(internCsrfRes.headers['set-cookie'])
    );

    mergeCookies(internCookies, internCsrfRes.cookies);

    const internLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      cookies: internCookies,
      headers: {
        'X-CSRF-Token': internCsrfToken,
        'Content-Type': 'application/json',
      },
      payload: {
        email: internEmail,
        password: internPassword,
      },
    });

    internToken = JSON.parse(internLoginRes.body).accessToken;

    mergeCookies(
      internCookies,
      parseSetCookie(internLoginRes.headers['set-cookie'])
    );
  });

  afterAll(async () => {
    // Only delete the rows we explicitly inserted — don't touch real login audit logs
    await pool.query('DELETE FROM audit_logs WHERE id IN ($1, $2, $3)', [
      seededAdminLogId,
      seededInternLogId,
      seededSystemLogId,
    ]);

    await pool.query('DELETE FROM users WHERE id = $1', [internId]);

    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/audit authentication', () => {
    it('should reject unauthenticated request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/audit as Admin', () => {
    it('should return audit logs with keyset pagination metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.limit).toBe(50);
      expect('nextCursor' in body).toBe(true);
    });

    it('should not strip ip_address or user_agent for admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?userId=${internId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      const seededLog = body.data.find((log) => log.id === seededInternLogId);

      expect(seededLog).toBeDefined();
      expect(seededLog.ip_address).toBe('10.0.0.1');
      expect(seededLog.user_agent).toBe('Chrome/100');
    });

    it('should paginate using an opaque cursor', async () => {
      const firstRes = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=2',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(firstRes.statusCode).toBe(200);

      const firstBody = JSON.parse(firstRes.body);

      expect(firstBody.data.length).toBe(2);
      expect(firstBody.limit).toBe(2);

      if (!firstBody.nextCursor) {
        return;
      }

      expect(typeof firstBody.nextCursor).toBe('string');
      expect(firstBody.nextCursor.length).toBeGreaterThan(0);

      const secondRes = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?limit=2&cursor=${encodeURIComponent(
          firstBody.nextCursor
        )}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(secondRes.statusCode).toBe(200);

      const secondBody = JSON.parse(secondRes.body);

      expect(secondBody.data.length).toBeGreaterThan(0);
      expect(secondBody.limit).toBe(2);

      const firstIds = new Set(firstBody.data.map((log) => log.id));

      expect(secondBody.data.some((log) => firstIds.has(log.id))).toBe(false);
    });

    it('should reject an invalid cursor', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?cursor=invalid-cursor',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.body);

      expect(body.error).toBe('Invalid cursor');
    });

    it('should reject limit over 100', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=200',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should accept limit of exactly 100', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=100',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.limit).toBe(100);
    });

    it('should reject non-numeric limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=abc',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should filter by userId and only return that user's logs", async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?userId=${internId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.data.every((log) => log.user_id === internId)).toBe(true);

      const seededLog = body.data.find((log) => log.id === seededInternLogId);

      expect(seededLog).toBeDefined();
    });

    it('should reject invalid UUID for userId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?userId=not-a-uuid',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for an invalid startDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?startDate=not-a-date',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();

      expect(body.error).toBe('Invalid query parameters');

      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'startDate must be a valid date',
          }),
        ])
      );
    });

    it('should return 400 for an invalid endDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?endDate=not-a-date',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();

      expect(body.error).toBe('Invalid query parameters');

      expect(body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'endDate must be a valid date',
          }),
        ])
      );
    });

    it('should filter by resourceType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?resourceType=system',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.data.every((log) => log.resource_type === 'system')).toBe(
        true
      );

      const seededLog = body.data.find((log) => log.id === seededSystemLogId);

      expect(seededLog).toBeDefined();
    });

    it('should return empty data array when no logs match filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?resourceType=nonexistent_type_xyz',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.data).toEqual([]);
      expect(body.nextCursor).toBeNull();
    });

    it('should combine userId and resourceType filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?userId=${internId}&resourceType=auth`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(
        body.data.every(
          (log) => log.user_id === internId && log.resource_type === 'auth'
        )
      ).toBe(true);

      const seededLog = body.data.find((log) => log.id === seededInternLogId);

      expect(seededLog).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Non-Admin (Intern)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /api/audit as Non-Admin (Intern)', () => {
    it("should only return the intern's own audit logs", async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: {
          Authorization: `Bearer ${internToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.data.every((log) => log.user_id === internId)).toBe(true);

      const seededLog = body.data.find((log) => log.id === seededInternLogId);

      expect(seededLog).toBeDefined();
    });

    it('should ignore userId param for non-admins and always return only own logs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?userId=${adminUserId}`,
        headers: {
          Authorization: `Bearer ${internToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.data.every((log) => log.user_id === internId)).toBe(true);
      expect(body.data.some((log) => log.user_id === adminUserId)).toBe(false);
    });

    it("should not strip ip_address or user_agent from intern's own seeded log", async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: {
          Authorization: `Bearer ${internToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      const seededLog = body.data.find((log) => log.id === seededInternLogId);

      expect(seededLog).toBeDefined();
      expect(seededLog.ip_address).toBe('10.0.0.1');
      expect(seededLog.user_agent).toBe('Chrome/100');
    });

    it('should allow intern to filter their own logs by resourceType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?resourceType=auth',
        headers: {
          Authorization: `Bearer ${internToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.data.every((log) => log.user_id === internId)).toBe(true);
      expect(body.data.every((log) => log.resource_type === 'auth')).toBe(true);

      const seededLog = body.data.find((log) => log.id === seededInternLogId);

      expect(seededLog).toBeDefined();
    });

    it('should return empty results when intern filters by a resourceType with no own logs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?resourceType=system',
        headers: {
          Authorization: `Bearer ${internToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.body);

      expect(body.data).toEqual([]);
      expect(body.nextCursor).toBeNull();
    });

    it('should support cursor pagination for non-admin users', async () => {
      const firstRes = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=10',
        headers: {
          Authorization: `Bearer ${internToken}`,
        },
      });

      expect(firstRes.statusCode).toBe(200);

      const firstBody = JSON.parse(firstRes.body);

      expect(firstBody.limit).toBe(10);
      expect(firstBody.data.every((log) => log.user_id === internId)).toBe(
        true
      );

      if (!firstBody.nextCursor) {
        return;
      }

      const secondRes = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?limit=10&cursor=${encodeURIComponent(
          firstBody.nextCursor
        )}`,
        headers: {
          Authorization: `Bearer ${internToken}`,
        },
      });

      expect(secondRes.statusCode).toBe(200);

      const secondBody = JSON.parse(secondRes.body);

      expect(secondBody.data.every((log) => log.user_id === internId)).toBe(
        true
      );

      const firstIds = new Set(firstBody.data.map((log) => log.id));

      expect(secondBody.data.some((log) => firstIds.has(log.id))).toBe(false);
    });
  });
});
