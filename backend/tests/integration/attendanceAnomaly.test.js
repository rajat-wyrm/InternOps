const app = require('../../src/app');
const pool = require('../../src/config/db');
const { generateAccessToken } = require('../../src/utils/tokens');

describe('Attendance Anomalies Integration Tests', () => {
  let adminToken;
  let managerToken;
  let unauthorizedToken;
  const fakeAdminId = '00000000-0000-0000-0000-000000000000';
  let fakeInternId = '11111111-1111-1111-1111-111111111111';
  let fakeManagerId = '22222222-2222-2222-2222-222222222222';
  let fakeOtherManagerId = '33333333-3333-3333-3333-333333333333';
  let testAnomalyId;

  beforeAll(async () => {
    await app.ready();

    // 1. Generate access tokens for roles
    adminToken = generateAccessToken({
      id: fakeAdminId,
      role: 'ADMIN',
      department_id: null,
    });

    managerToken = generateAccessToken({
      id: fakeManagerId,
      role: 'TL',
      department_id: null,
    });

    unauthorizedToken = generateAccessToken({
      id: fakeInternId,
      role: 'INTERN',
      department_id: null,
    });

    // 2. Clean up and insert test users and department
    await pool.query('DELETE FROM attendance_anomalies');
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
      fakeInternId,
      fakeManagerId,
      fakeOtherManagerId,
      fakeAdminId,
    ]);

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name, suspended, must_change_password)
       VALUES ($1, 'anomaly_admin@test.com', 'pwd', 'ADMIN', 'Anomaly Admin', FALSE, FALSE)`,
      [fakeAdminId]
    );

    // Insert manager and intern
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name)
       VALUES ($1, 'mgr@test.com', 'pwd', 'TL', 'Test Manager')`,
      [fakeManagerId]
    );

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, manager_id, full_name)
       VALUES ($1, 'int@test.com', 'pwd', 'INTERN', $2, 'Test Intern')`,
      [fakeInternId, fakeManagerId]
    );

    // Insert other manager (not in hierarchy)
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name)
       VALUES ($1, 'other_mgr@test.com', 'pwd', 'TL', 'Other Manager')`,
      [fakeOtherManagerId]
    );

    // 3. Insert a mock anomaly to test list and view
    const anomalyRes = await pool.query(
      `INSERT INTO attendance_anomalies (intern_id, flag_type, severity, reason, notification_status)
       VALUES ($1, 'repetitive_late_pattern', 'medium', 'Arrived late repeatedly', 'PENDING')
       RETURNING id`,
      [fakeInternId]
    );
    testAnomalyId = anomalyRes.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM attendance_anomalies');
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
      fakeInternId,
      fakeManagerId,
      fakeOtherManagerId,
      fakeAdminId,
    ]);
    await app.close();
  });

  describe('GET /api/v1/attendance/anomalies', () => {
    it('should require authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/anomalies',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should deny access to unauthorized roles (INTERN)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/anomalies',
        headers: {
          Authorization: `Bearer ${unauthorizedToken}`,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow access to manager (TL) and only show subordinates', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/anomalies',
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].intern_id).toBe(fakeInternId);
    });

    it('should hide subordinate anomalies from managers outside of hierarchy', async () => {
      const otherManagerToken = generateAccessToken({
        id: fakeOtherManagerId,
        role: 'TL',
        department_id: null,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/anomalies',
        headers: {
          Authorization: `Bearer ${otherManagerToken}`,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.length).toBe(0); // Cannot see the anomaly since uB is not a subordinate of other manager
    });

    it('should allow access to ADMIN to see all anomalies', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/anomalies',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/attendance/anomalies/:id/view', () => {
    it('should mark anomaly as viewed if caller is direct manager', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/attendance/anomalies/${testAnomalyId}/view`,
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.viewed_by).toBe(fakeManagerId);
      expect(data.viewed_at).not.toBeNull();
    });

    it('should deny marking as viewed if caller is not in hierarchy', async () => {
      const otherManagerToken = generateAccessToken({
        id: fakeOtherManagerId,
        role: 'TL',
        department_id: null,
      });

      // Insert another anomaly to test
      const freshAnomaly = await pool.query(
        `INSERT INTO attendance_anomalies (intern_id, flag_type, severity, reason)
         VALUES ($1, 'repetitive_late_pattern', 'medium', 'Arrived late')
         RETURNING id`,
        [fakeInternId]
      );
      const freshId = freshAnomaly.rows[0].id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/attendance/anomalies/${freshId}/view`,
        headers: {
          Authorization: `Bearer ${otherManagerToken}`,
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/attendance/anomalies/analyze', () => {
    afterEach(() => {
      delete global.fetch;
    });

    it('should successfully trigger the analyze job and route to FastAPI', async () => {
      // Mock global fetch to fastAPI anomalies/analyze endpoint
      global.fetch = jest.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            status: 'accepted',
            message:
              'AI attendance anomaly detection job has been scheduled in the background.',
          }),
        };
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/anomalies/analyze',
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(res.statusCode).toBe(202);
      const data = JSON.parse(res.body);
      expect(data.status).toBe('accepted');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
