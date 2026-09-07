const pool = require('../../src/config/db');
jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
const repo = require('../../src/modules/hr/repository');
describe('HR repository', () => {
  beforeEach(() => jest.clearAllMocks());
  it('returns one combined dashboard contract', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 3, active: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'u1' }] })
      .mockResolvedValueOnce({ rows: [{ label: 'INTERN', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ label: 'Engineering', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'u1' }] });
    const result = await repo.getDashboard({});
    expect(result.summary).toMatchObject({ total: 3, active: 2 });
    expect(result.directory).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledTimes(5);
  });
  it('parameterizes search and status filters', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await repo.getDashboard({ search: 'alex', status: 'ACTIVE' });
    expect(pool.query.mock.calls[0][1]).toEqual(['%alex%', 'ACTIVE']);
    expect(pool.query.mock.calls[0][0]).toContain('ILIKE $1');
    expect(pool.query.mock.calls[0][0]).toContain('= $2');
  });
});
