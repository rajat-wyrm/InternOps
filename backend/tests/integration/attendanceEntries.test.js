const app = require('../../src/app');
const pool = require('../../src/config/db');
const { generateAccessToken } = require('../../src/utils/tokens');

describe('Attendance API', () => {
  const fakeCaptainId = '44444444-4444-4444-4444-444444444444';
  let captainToken;

  const attendanceDates = ['2026-08-27', '2026-08-28', '2026-08-29'];

  beforeAll(async () => {
    await app.ready();

    await pool.query('DELETE FROM attendance WHERE user_id = $1', [
      fakeCaptainId,
    ]);

    await pool.query('DELETE FROM users WHERE id = $1', [fakeCaptainId]);

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name)
       VALUES ($1, 'bulk_captain@test.com', 'pwd', 'CAPTAIN', 'Bulk Test Captain')`,
      [fakeCaptainId]
    );

    captainToken = generateAccessToken({
      id: fakeCaptainId,
      role: 'CAPTAIN',
      department_id: null,
    });

    for (const [index, date] of attendanceDates.entries()) {
      await pool.query(
        `INSERT INTO attendance
          (user_id, marked_by, date, status, remarks)
         VALUES ($1, $1, $2, 'PRESENT', $3)`,
        [fakeCaptainId, date, `pagination test ${index + 1}`]
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM attendance WHERE user_id = $1', [
      fakeCaptainId,
    ]);

    await pool.query('DELETE FROM users WHERE id = $1', [fakeCaptainId]);

    await app.close();
  });

  test('POST /attendance/bulk rejects more than 200 entries', async () => {
    const entries = Array.from({ length: 201 }, () => ({
      user_id: '00000000-0000-0000-0000-000000000099',
      date: '2026-08-30',
      status: 'PRESENT',
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/bulk',
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
      payload: {
        entries,
      },
    });

    expect(res.statusCode).toBe(400);

    const body = JSON.parse(res.body);

    expect(body.error).toBe('Validation failed');
  });

  test('POST /attendance/bulk rejects future dates', async () => {
    const futureDate = new Date();

    futureDate.setDate(futureDate.getDate() + 5);

    const futureDateStr = futureDate.toISOString().slice(0, 10);

    const entries = [
      {
        user_id: '00000000-0000-0000-0000-000000000099',
        date: futureDateStr,
        status: 'PRESENT',
      },
    ];

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/bulk',
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
      payload: {
        entries,
      },
    });

    expect(res.statusCode).toBe(400);

    const body = JSON.parse(res.body);

    expect(body.error).toBe('Attendance cannot be marked for future dates');
  });

  test('POST /attendance/mark rejects future dates', async () => {
    const futureDate = new Date();

    futureDate.setDate(futureDate.getDate() + 5);

    const futureDateStr = futureDate.toISOString().slice(0, 10);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/mark',
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
      payload: {
        user_id: '00000000-0000-0000-0000-000000000099',
        date: futureDateStr,
        status: 'PRESENT',
      },
    });

    expect(res.statusCode).toBe(400);

    const body = JSON.parse(res.body);

    expect(body.error).toBe('Attendance cannot be marked for future dates');
  });

  test('GET /attendance/:userId returns keyset pagination metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/attendance/${fakeCaptainId}?limit=2`,
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
    });

    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);

    expect(Array.isArray(body.records)).toBe(true);
    expect(body.records).toHaveLength(2);
    expect(body.limit).toBe(2);
    expect(typeof body.nextCursor).toBe('string');
    expect(body.nextCursor.length).toBeGreaterThan(0);
  });

  test('GET /attendance/:userId uses the cursor to return the next page without duplicates', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: `/api/v1/attendance/${fakeCaptainId}?limit=2`,
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
    });

    expect(firstRes.statusCode).toBe(200);

    const firstBody = JSON.parse(firstRes.body);

    expect(firstBody.records).toHaveLength(2);
    expect(firstBody.nextCursor).toBeTruthy();

    const firstIds = new Set(firstBody.records.map((record) => record.id));

    const secondRes = await app.inject({
      method: 'GET',
      url: `/api/v1/attendance/${fakeCaptainId}?limit=2&cursor=${encodeURIComponent(
        firstBody.nextCursor
      )}`,
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
    });

    expect(secondRes.statusCode).toBe(200);

    const secondBody = JSON.parse(secondRes.body);

    expect(secondBody.records).toHaveLength(1);
    expect(secondBody.limit).toBe(2);

    for (const record of secondBody.records) {
      expect(firstIds.has(record.id)).toBe(false);
    }

    expect(secondBody.nextCursor).toBeNull();
  });

  test('GET /attendance/:userId rejects an invalid cursor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/attendance/${fakeCaptainId}?limit=2&cursor=invalid-cursor`,
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
    });

    expect(res.statusCode).toBe(400);

    const body = JSON.parse(res.body);

    expect(body.error).toBe('Invalid cursor');
  });

  test('GET /attendance/:userId preserves date filters with cursor pagination', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: `/api/v1/attendance/${fakeCaptainId}?from=2026-08-28&to=2026-08-29&limit=1`,
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
    });

    expect(firstRes.statusCode).toBe(200);

    const firstBody = JSON.parse(firstRes.body);

    expect(firstBody.records).toHaveLength(1);
    expect(firstBody.records[0].date).toBe('2026-08-29');
    expect(firstBody.nextCursor).toBeTruthy();

    const secondRes = await app.inject({
      method: 'GET',
      url: `/api/v1/attendance/${fakeCaptainId}?from=2026-08-28&to=2026-08-29&limit=1&cursor=${encodeURIComponent(
        firstBody.nextCursor
      )}`,
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
    });

    expect(secondRes.statusCode).toBe(200);

    const secondBody = JSON.parse(secondRes.body);

    expect(secondBody.records).toHaveLength(1);
    expect(secondBody.records[0].date).toBe('2026-08-28');
    expect(secondBody.nextCursor).toBeNull();
  });

  test('GET /attendance/:userId returns null nextCursor when no more records exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/attendance/${fakeCaptainId}?limit=100`,
      headers: {
        authorization: `Bearer ${captainToken}`,
      },
    });

    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);

    expect(body.records).toHaveLength(3);
    expect(body.limit).toBe(100);
    expect(body.nextCursor).toBeNull();
  });
});
