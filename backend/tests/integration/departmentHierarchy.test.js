'use strict';

const crypto = require('crypto');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const { generateAccessToken } = require('../../src/utils/tokens');

const runId = Date.now();
const departmentNames = [
  `Hierarchy Test Department ${runId}`,
  `Hierarchy Other Department ${runId}`,
];
const testEmails = [
  `hierarchy-admin-${runId}@test.internops.local`,
  `hierarchy-senior-${runId}@test.internops.local`,
  `hierarchy-tl-${runId}@test.internops.local`,
  `hierarchy-captain-${runId}@test.internops.local`,
  `hierarchy-other-tl-${runId}@test.internops.local`,
];

const ids = Object.fromEntries(
  ['admin', 'senior', 'tl', 'captain', 'otherTl'].map((role) => [
    role,
    crypto.randomUUID(),
  ])
);

let departmentId;
let otherDepartmentId;
let adminToken;
let seniorToken;
let tlToken;

describe('Department Hierarchy API Filtering (#1347)', () => {
  beforeAll(async () => {
    await app.ready();

    const departmentRes = await pool.query(
      'INSERT INTO departments (name, created_by) VALUES ($1, NULL), ($2, NULL) RETURNING id, name',
      departmentNames
    );
    departmentId = departmentRes.rows.find(
      (department) => department.name === departmentNames[0]
    ).id;
    otherDepartmentId = departmentRes.rows.find(
      (department) => department.name === departmentNames[1]
    ).id;

    await pool.query(
      `INSERT INTO users
        (id, email, password_hash, role, manager_id, department_id, full_name)
       VALUES
        ($1, $2, 'test-password-hash', 'ADMIN', NULL, $3, 'Hierarchy Admin'),
        ($4, $5, 'test-password-hash', 'SENIOR_TL', $1, $3, 'Hierarchy Senior TL'),
        ($6, $7, 'test-password-hash', 'TL', $4, $3, 'Hierarchy TL'),
        ($8, $9, 'test-password-hash', 'CAPTAIN', $6, $3, 'Hierarchy Captain'),
        ($10, $11, 'test-password-hash', 'TL', NULL, $12, 'Other Department TL')`,
      [
        ids.admin,
        testEmails[0],
        departmentId,
        ids.senior,
        testEmails[1],
        ids.tl,
        testEmails[2],
        ids.captain,
        testEmails[3],
        ids.otherTl,
        testEmails[4],
        otherDepartmentId,
      ]
    );

    adminToken = generateAccessToken({ id: ids.admin, role: 'ADMIN' });
    seniorToken = generateAccessToken({ id: ids.senior, role: 'SENIOR_TL' });
    tlToken = generateAccessToken({ id: ids.tl, role: 'TL' });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [
      testEmails,
    ]);
    await pool.query('DELETE FROM departments WHERE name = ANY($1::text[])', [
      departmentNames,
    ]);
    await app.close();
  });

  test.each([
    ['admin', () => adminToken, ids.tl],
    ['senior TL', () => seniorToken, ids.tl],
    ['TL', () => tlToken, ids.captain],
  ])(
    '%s can request an allowed manager full team',
    async (_role, getToken, managerId) => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/hierarchy/full-team?managerId=${managerId}`,
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual(
        expect.objectContaining({ data: expect.any(Array), page: 1, limit: 10 })
      );
      if (_role === 'senior TL') {
        const body = JSON.parse(res.body);
        expect(body.data.map((member) => member.id)).toEqual(
          expect.arrayContaining([ids.captain])
        );
      }
    }
  );

  test('Senior TL is denied for a cross-department manager', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/hierarchy/full-team?managerId=${ids.otherTl}`,
      headers: { Authorization: `Bearer ${seniorToken}` },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toMatch(
      /outside.*hierarchy or department/i
    );
  });

  test('TL is denied for a manager outside the hierarchy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/hierarchy/full-team?managerId=${ids.senior}`,
      headers: { Authorization: `Bearer ${tlToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  test('full team remains denied without authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/hierarchy/full-team?managerId=${ids.tl}`,
    });

    expect(res.statusCode).toBe(401);
  });

  test('GET /attendance/authorized-members requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/attendance/authorized-members?department_id=00000000-0000-0000-0000-000000000001',
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  test('GET /tasks handles department_id query parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tasks?department_id=00000000-0000-0000-0000-000000000001',
    });
    expect([200, 401, 403]).toContain(res.statusCode);
  });

  test('GET /ratings/department/:deptId handles department ratings request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ratings/department/00000000-0000-0000-0000-000000000001',
    });
    expect([401, 403]).toContain(res.statusCode);
  });
});
