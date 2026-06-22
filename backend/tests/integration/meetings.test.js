const app = require('../../src/app');
const pool = require('../../src/config/db');
const {
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  resetSeededAdminPassword,
  parseSetCookie,
  mergeCookies,
} = require('./helpers');

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

let csrfToken;
let cookies;
let accessToken;
let meetingId;

beforeAll(async () => {
  await app.ready();

  // Defense in depth — globalSetup already does this, but a single-
  // file run with `jest path/to.test.js` skips the global.
  await resetSeededAdminPassword();

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

  cookies = {};
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
  });
  csrfToken = JSON.parse(csrfRes.body).csrfToken;
  mergeCookies(cookies, parseSetCookie(csrfRes.headers['set-cookie']));
  mergeCookies(cookies, csrfRes.cookies);

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    cookies,
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
    payload: {
      email: SEEDED_ADMIN_EMAIL,
      password: SEEDED_ADMIN_PASSWORD,
    },
  });
  if (loginRes.statusCode !== 200) {
    throw new Error(
      `Seeded admin login failed (${loginRes.statusCode}): ${loginRes.body}`
    );
  }
  accessToken = JSON.parse(loginRes.body).accessToken;
  mergeCookies(cookies, parseSetCookie(loginRes.headers['set-cookie']));
});

afterAll(async () => {
  // Clean up every artifact this run created so the next run starts
  // from a known state.
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
    await resetSeededAdminPassword();
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

function inject(method, url, opts = {}) {
  return app.inject({
    method,
    url,
    cookies: { ...cookies, ...(opts.cookies || {}) },
    headers: authHeaders(),
    payload: opts.payload,
  });
}

async function createUserAsAdmin(user) {
  const res = await inject('POST', '/api/auth/register', {
    payload: user,
  });
  return JSON.parse(res.body);
}

describe('Meetings Integration Tests', () => {
  describe('POST /api/meetings', () => {
    it('should create a new meeting', async () => {
      const res = await inject('POST', '/api/meetings', {
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
      const res = await inject('POST', '/api/meetings', {
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
        cookies: {
          'csrf-token': cookies['csrf-token'] || '',
          'csrf-sid': cookies['csrf-sid'] || '',
        },
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { email: TEST_USERS[0], password: 'Manager@123' },
      });
      const managerToken = JSON.parse(loginRes.body).accessToken;
      const managerCookies = mergeCookies(
        {},
        parseSetCookie(loginRes.headers['set-cookie'])
      );

      // The login rotated the csrf-sid, so the existing X-CSRF-Token
      // (derived from the admin's session) is no longer valid. Fetch
      // a fresh token bound to the manager's session.
      const managerCsrfRes = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf-token',
        cookies: managerCookies,
      });
      const managerCsrfToken = JSON.parse(managerCsrfRes.body).csrfToken;
      mergeCookies(managerCookies, managerCsrfRes.cookies);

      const managerHeaders = {
        Authorization: `Bearer ${managerToken}`,
        'X-CSRF-Token': managerCsrfToken,
        'Content-Type': 'application/json',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/meetings',
        cookies: managerCookies,
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
    }, 30000);
  });

  describe('GET /api/meetings', () => {
    it('should list meetings', async () => {
      const res = await inject('GET', '/api/meetings');
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(typeof body.pagination.total).toBe('number');
    });
  });

  describe('GET /api/meetings/:id', () => {
    it('should get meeting by ID', async () => {
      const res = await inject('GET', `/api/meetings/${meetingId}`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(meetingId);
    });

    it('should return 404 for non-existent meeting', async () => {
      const res = await inject(
        'GET',
        '/api/meetings/00000000-0000-0000-0000-000000000000'
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/meetings/:id', () => {
    it('should update meeting title', async () => {
      const res = await inject('PATCH', `/api/meetings/${meetingId}`, {
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

      const res = await inject('POST', `/api/meetings/${meetingId}/attendees`, {
        payload: { userId },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe('Attendee added');

      const auditRes = await pool.query(
        "SELECT * FROM audit_logs WHERE action = 'MEETING_ATTENDEE_ADDED' AND resource_id = $1 ORDER BY created_at DESC LIMIT 1",
        [meetingId]
      );
      expect(auditRes.rowCount).toBe(1);
      // details is a JSONB column; node-postgres returns it as a parsed
      // object directly, so we read the property without JSON.parse.
      expect(auditRes.rows[0].details).toMatchObject({
        addedUserId: userId,
      });
    });

    it('should remove an attendee from the meeting and create an audit log entry', async () => {
      const userRes = await pool.query('SELECT id FROM users LIMIT 1');
      const userId = userRes.rows[0].id;

      const res = await inject(
        'DELETE',
        `/api/meetings/${meetingId}/attendees/${userId}`,
        { payload: {} }
      );
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe('Attendee removed');

      const auditRes = await pool.query(
        "SELECT * FROM audit_logs WHERE action = 'MEETING_ATTENDEE_REMOVED' AND resource_id = $1 ORDER BY created_at DESC LIMIT 1",
        [meetingId]
      );
      expect(auditRes.rowCount).toBe(1);
      expect(auditRes.rows[0].details).toMatchObject({
        removedUserId: userId,
      });
    });
  });

  describe('DELETE /api/meetings/:id', () => {
    it('should delete meeting', async () => {
      const res = await inject('DELETE', `/api/meetings/${meetingId}`, {
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for already deleted meeting', async () => {
      const res = await inject('GET', `/api/meetings/${meetingId}`);
      expect(res.statusCode).toBe(404);
    });
  });
});
