const app = require('../../src/app');

app.addHook('onSend', (request, reply, payload, done) => {
  if (request.headers['x-simulate-failure'] === 'true') {
    return done(
      new Error('Simulated post-login serialization/sending failure')
    );
  }
  done(null, payload);
});
const pool = require('../../src/config/db');
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
    await app.ready();
    await resetSeededAdminPassword();

    // Find admin user ID
    const adminUserRes = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [SEEDED_ADMIN_EMAIL]
    );
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

  // ─── Authentication ────────────────────────────────────────────────────────

  describe('GET /api/audit authentication', () => {
    it('should reject unauthenticated request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─── Admin ─────────────────────────────────────────────────────────────────

  describe('GET /api/audit as Admin', () => {
    it('should return all audit logs with pagination metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      // At least our 3 seeded rows plus real login logs
      expect(body.total).toBeGreaterThanOrEqual(3);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(50);
    });

    it('should not strip ip_address or user_agent for admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?userId=${internId}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Find our specific seeded row by ID — not just any intern row
      const seededLog = body.data.find((log) => log.id === seededInternLogId);
      expect(seededLog).toBeDefined();
      expect(seededLog.ip_address).toBe('10.0.0.1');
      expect(seededLog.user_agent).toBe('Chrome/100');
    });

    it('should support pagination parameters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=2&page=1',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBe(2);
      expect(body.limit).toBe(2);
      expect(body.page).toBe(1);
    });

    it('should reject limit over 100', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=200',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should accept limit of exactly 100', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=100',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.limit).toBe(100);
    });

    it('should reject non-numeric limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=abc',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject page less than 1', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?page=0',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it("should filter by userId and only return that user's logs", async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?userId=${internId}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Every returned row must belong to the intern
      expect(body.data.every((log) => log.user_id === internId)).toBe(true);
      // Must include at least our seeded row
      const seededLog = body.data.find((log) => log.id === seededInternLogId);
      expect(seededLog).toBeDefined();
    });

    it('should reject invalid UUID for userId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?userId=not-a-uuid',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should filter by resourceType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?resourceType=system',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.every((log) => log.resource_type === 'system')).toBe(
        true
      );
      // Must include our seeded system log
      const seededLog = body.data.find((log) => log.id === seededSystemLogId);
      expect(seededLog).toBeDefined();
    });

    it('should return empty data array when no logs match filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?resourceType=nonexistent_type_xyz',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should combine userId and resourceType filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?userId=${internId}&resourceType=auth`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(
        body.data.every(
          (log) => log.user_id === internId && log.resource_type === 'auth'
        )
      ).toBe(true);
      // Our seeded intern log is resource_type=auth, so it must be present
      const seededLog = body.data.find((log) => log.id === seededInternLogId);
      expect(seededLog).toBeDefined();
    });
  });

  // ─── Non-Admin (Intern) ────────────────────────────────────────────────────

  describe('GET /api/audit as Non-Admin (Intern)', () => {
    it("should only return the intern's own audit logs", async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: { Authorization: `Bearer ${internToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Every row must belong to intern — no other user's logs
      expect(body.data.every((log) => log.user_id === internId)).toBe(true);
      // Our seeded row must be present
      const seededLog = body.data.find((log) => log.id === seededInternLogId);
      expect(seededLog).toBeDefined();
    });

    it('should ignore userId param for non-admins and always return only own logs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/audit?userId=${adminUserId}`,
        headers: { Authorization: `Bearer ${internToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Must never contain admin logs
      expect(body.data.every((log) => log.user_id === internId)).toBe(true);
      expect(body.data.some((log) => log.user_id === adminUserId)).toBe(false);
    });

    it("should not strip ip_address or user_agent from intern's own seeded log", async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: { Authorization: `Bearer ${internToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Look up the specific seeded row by its known ID, not just any intern log
      const seededLog = body.data.find((log) => log.id === seededInternLogId);
      expect(seededLog).toBeDefined();
      expect(seededLog.ip_address).toBe('10.0.0.1');
      expect(seededLog.user_agent).toBe('Chrome/100');
    });

    it('should allow intern to filter their own logs by resourceType', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?resourceType=auth',
        headers: { Authorization: `Bearer ${internToken}` },
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
        headers: { Authorization: `Bearer ${internToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // System log has user_id = null — intern must not see it
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should support pagination for non-admin users', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit?limit=10&page=1',
        headers: { Authorization: `Bearer ${internToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
      expect(body.data.every((log) => log.user_id === internId)).toBe(true);
    });
  });

  describe('Deferred Audit Logging on login success and failure', () => {
    it('should write a LOGIN_SUCCESS audit log if login request completes successfully', async () => {
      // Clear prior login logs for this user to ensure isolation
      await pool.query(
        "DELETE FROM audit_logs WHERE user_id = $1 AND action IN ('LOGIN', 'LOGIN_SUCCESS')",
        [adminUserId]
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: SEEDED_ADMIN_EMAIL,
          password: SEEDED_ADMIN_PASSWORD,
        },
      });

      expect(res.statusCode).toBe(200);

      // Wait for async onResponse hook to write to DB
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 AND action = 'LOGIN_SUCCESS'`,
        [adminUserId]
      );
      expect(dbRes.rows.length).toBeGreaterThan(0);

      const logIds = dbRes.rows.map((r) => r.id);
      await pool.query('DELETE FROM audit_logs WHERE id = ANY($1)', [logIds]);
    });

    it('should not write an audit log if login request fails due to downstream/serialization error', async () => {
      // Clear prior login logs for this user to ensure isolation
      await pool.query(
        "DELETE FROM audit_logs WHERE user_id = $1 AND action IN ('LOGIN', 'LOGIN_SUCCESS')",
        [adminUserId]
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'x-simulate-failure': 'true',
        },
        payload: {
          email: SEEDED_ADMIN_EMAIL,
          password: SEEDED_ADMIN_PASSWORD,
        },
      });

      expect(res.statusCode).toBe(500);

      // Wait for potential async hooks to finish
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 AND action IN ('LOGIN', 'LOGIN_SUCCESS')`,
        [adminUserId]
      );
      expect(dbRes.rows.length).toBe(0);
    });
  });
});
