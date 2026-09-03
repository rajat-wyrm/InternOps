'use strict';

const app = require('../../src/app');
const pool = require('../../src/config/db');
const { generateAccessToken } = require('../../src/utils/tokens');

describe('Attendance Bulk API', () => {
  const fakeCaptainId = '44444444-4444-4444-4444-444444444444';
  let captainToken;

  beforeAll(async () => {
    await app.ready();

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
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [fakeCaptainId]);
    await app.close();
  });

  test('POST /attendance/bulk rejects more than 200 entries', async () => {
    const entries = Array.from({ length: 201 }, () => ({
      user_id: '00000000-0000-0000-0000-000000000099', // different from captain's own id
      date: '2026-08-30',
      status: 'PRESENT',
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/bulk',
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { entries },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Validation failed');
  });
});
