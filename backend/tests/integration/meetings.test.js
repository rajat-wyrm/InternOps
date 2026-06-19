const supertest = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');

// Each test run gets a fresh set of fixture users and meetings. The
// previous implementation only cleaned up the hierarchy-test users in
// beforeAll, which left a previous run's meeting rows visible to
// subsequent runs and produced cascading test failures (#387).
const runId = Date.now();
const TEST_USERS = [
  `manager+run${runId}@internops.com`,
  `subordinate+run${runId}@internops.com`,
  `outsider+run${runId}@internops.com`,
];
const MEETING_TITLE = `Test Meeting ${runId}`;
const HIERARCHY_MEETING_TITLE = `Hierarchy Test Meeting ${runId}`;

let csrfToken, csrfCookieValue, accessToken, meetingId;

beforeAll(async () => {
  await app.ready();

  // Defensive cleanup: delete any prior-run meetings and users tied to
  // the same fixture emails so duplicate-key errors don't cascade.
  await pool.query(
    `DELETE FROM meeting_attendees
     WHERE meeting_id IN (
       SELECT id FROM meetings WHERE title = $1 OR title = $2
     )`,
    [MEETING_TITLE, HIERARCHY_MEETING_TITLE]
  );
  await pool.query('DELETE FROM meetings WHERE title = $1 OR title = $2', [
    MEETING_TITLE,
    HIERARCHY_MEETING_TITLE,
  ]);
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [
    TEST_USERS,
  ]);

  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
  });
  csrfToken = JSON.parse(csrfRes.body).csrfToken;
  const csrfCookie = csrfRes.cookies.find((c) => c.name === 'csrf-token');
  csrfCookieValue = csrfCookie ? csrfCookie.value : csrfToken;
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
    payload: { email: 'admin@internops.com', password: 'Admin@123' },
  });
  accessToken = JSON.parse(loginRes.body).accessToken;
});

afterAll(async () => {
  // Clean up every artifact this run created so the next run starts
  // from a known state. Failures here are non-fatal — the test
  // assertions are what we care about.
  try {
    await pool.query(
      `DELETE FROM meeting_attendees
       WHERE meeting_id IN (
         SELECT id FROM meetings WHERE title = $1 OR title = $2
       )`,
      [MEETING_TITLE, HIERARCHY_MEETING_TITLE]
    );
    await pool.query('DELETE FROM meetings WHERE title = $1 OR title = $2', [
      MEETING_TITLE,
      HIERARCHY_MEETING_TITLE,
    ]);
    await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [
      TEST_USERS,
    ]);
  } catch {
    /* best-effort cleanup */
  }
  await app.close();
});

function authHeaders() {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  };
}

async function createUserAsAdmin(user) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    cookies: { 'csrf-token': csrfCookieValue },
    headers: authHeaders(),
    payload: user,
  });
  return JSON.parse(res.body);
}

describe('Meetings Integration Tests', () => {
  describe('POST /api/meetings', () => {
    it('should create a new meeting', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/meetings',
        cookies: { 'csrf-token': csrfCookieValue },
        headers: authHeaders(),
        payload: {
          title: MEETING_TITLE,
          description: 'Discussion',
          meetingDate: '2026-12-01',
          startTime: '10:00',
          endTime: '11:00',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      meetingId = body.id || body.meeting?.id || body.data?.id;
      expect(meetingId).toBeDefined();
    });

    it('should reject meeting without title', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/meetings',
        cookies: { 'csrf-token': csrfCookieValue },
        headers: authHeaders(),
        payload: { meetingDate: '2026-12-01' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should report skipped attendees when hierarchy access is denied', async () => {
      const manager = await createUserAsAdmin({
        email: TEST_USERS[0],
        password: 'Manager@123',
        role: 'TL',
        fullName: 'Team Lead',
      });
      const subordinate = await createUserAsAdmin({
        email: TEST_USERS[1],
        password: 'Subordinate@123',
        role: 'CAPTAIN',
        managerId: manager.id,
        fullName: 'Captain User',
      });
      const outsider = await createUserAsAdmin({
        email: TEST_USERS[2],
        password: 'Outsider@123',
        role: 'CAPTAIN',
        fullName: 'Outside User',
      });

      // login as manager
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { email: TEST_USERS[0], password: 'Manager@123' },
      });
      const managerToken = JSON.parse(loginRes.body).accessToken;
      const managerHeaders = {
        Authorization: `Bearer ${managerToken}`,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/meetings',
        cookies: { 'csrf-token': csrfCookieValue },
        headers: managerHeaders,
        payload: {
          title: HIERARCHY_MEETING_TITLE,
          meetingDate: '2026-12-02',
          attendeeIds: [subordinate.id, outsider.id],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.attendees).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: subordinate.id }),
        ])
      );
      expect(body.skippedAttendees).toEqual([
        expect.objectContaining({
          userId: outsider.id,
          reason: 'Not in your hierarchy',
        }),
      ]);
    });
  });

  describe('GET /api/meetings', () => {
    it('should list meetings', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/meetings',
        cookies: { 'csrf-token': csrfCookieValue },
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(typeof body.pagination.total).toBe('number');
    });
  });

  describe('GET /api/meetings/:id', () => {
    it('should get meeting by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/meetings/${meetingId}`,
        cookies: { 'csrf-token': csrfCookieValue },
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(meetingId);
    });

    it('should return 404 for non-existent meeting', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/meetings/00000000-0000-0000-0000-000000000000',
        cookies: { 'csrf-token': csrfCookieValue },
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/meetings/:id', () => {
    it('should update meeting title', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/meetings/${meetingId}`,
        cookies: { 'csrf-token': csrfCookieValue },
        headers: authHeaders(),
        payload: { title: 'Updated Meeting' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.title).toBe('Updated Meeting');
    });
  });

  describe('Attendee Management', () => {
    it('should add an attendee to the meeting and create an audit log entry', async () => {
      const userRes = await pool.query('SELECT id FROM users LIMIT 1');
      const userId = userRes.rows[0].id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/meetings/${meetingId}/attendees`,
        headers: authHeaders(),
        payload: { userId },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe('Attendee added');

      // Verify audit log
      const auditRes = await pool.query(
        "SELECT * FROM audit_logs WHERE action = 'MEETING_ATTENDEE_ADDED' AND resource_id = $1 ORDER BY created_at DESC LIMIT 1",
        [meetingId]
      );
      expect(auditRes.rowCount).toBe(1);
      expect(JSON.parse(auditRes.rows[0].details).addedUserId).toBe(userId);
    });

    it('should remove an attendee from the meeting and create an audit log entry', async () => {
      const userRes = await pool.query('SELECT id FROM users LIMIT 1');
      const userId = userRes.rows[0].id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/meetings/${meetingId}/attendees/${userId}`,
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe('Attendee removed');

      // Verify audit log
      const auditRes = await pool.query(
        "SELECT * FROM audit_logs WHERE action = 'MEETING_ATTENDEE_REMOVED' AND resource_id = $1 ORDER BY created_at DESC LIMIT 1",
        [meetingId]
      );
      expect(auditRes.rowCount).toBe(1);
      expect(JSON.parse(auditRes.rows[0].details).removedUserId).toBe(userId);
    });
  });

  describe('DELETE /api/meetings/:id', () => {
    it('should delete meeting', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/meetings/${meetingId}`,
        cookies: { 'csrf-token': csrfCookieValue },
        headers: authHeaders(),
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for already deleted meeting', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/meetings/${meetingId}`,
        cookies: { 'csrf-token': csrfCookieValue },
        headers: authHeaders(),
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
