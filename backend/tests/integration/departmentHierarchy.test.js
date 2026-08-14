'use strict';

const app = require('../../src/app');

describe('Department Hierarchy API Filtering (#1347)', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
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
