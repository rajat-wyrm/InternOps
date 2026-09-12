jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const pool = require('../../src/config/db');
const {
  checkHierarchyAccess,
  MAX_HIERARCHY_DEPTH,
  MAX_HIERARCHY_ROWS,
} = require('../../src/utils/hierarchy');
const hierarchyRepo = require('../../src/modules/hierarchy/repository');
const teamRepo = require('../../src/modules/team/repository');
const departmentsRepo = require('../../src/modules/departments/repository');
const departmentsService = require('../../src/modules/departments/service');

describe('hierarchy recursive CTE safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('checkHierarchyAccess uses a bounded path-aware upward CTE', async () => {
    const client = { query: jest.fn() };
    client.query
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { id: 'requester-id', role: 'TL', department_id: 'dept-1' },
          { id: 'target-id', role: 'INTERN', department_id: 'dept-1' },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });

    await expect(
      checkHierarchyAccess('requester-id', 'target-id', client)
    ).resolves.toBe(true);

    const [sql, params] = client.query.mock.calls[1];
    expect(sql).toContain('WITH RECURSIVE chain');
    expect(sql).toContain('ARRAY[id] AS path');
    expect(sql).toContain('NOT u.id = ANY(chain.path)');
    expect(sql).toContain('chain.depth < $3');
    expect(params).toEqual(['target-id', 'requester-id', MAX_HIERARCHY_DEPTH]);
  });

  test('getFullTeam uses deterministic rank ordering and cycle guards', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ role: 'TL', department_id: 'dept-1' }],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    await hierarchyRepo.getFullTeam('manager-id', { page: 2, limit: 25 });

    const [countSql, countParams] = pool.query.mock.calls[1];
    expect(countSql).toContain('ARRAY[$1::uuid, u.id] AS path');
    expect(countSql).toContain('NOT u.id = ANY(t.path)');
    expect(countParams).toEqual(['manager-id', MAX_HIERARCHY_DEPTH]);

    const [dataSql, dataParams] = pool.query.mock.calls[2];
    expect(dataSql).toContain('AS structural_rank');
    expect(dataSql).toContain('ORDER BY');
    expect(dataSql).toContain(
      "LOWER(COALESCE(NULLIF(TRIM(full_name), ''), email))"
    );
    expect(dataParams).toEqual(['manager-id', 25, 25, MAX_HIERARCHY_DEPTH]);
  });

  test('getTeamMembers caps rows and reuses the safe hierarchy CTE', async () => {
    pool.query.mockResolvedValueOnce({
      rows: Array.from({ length: MAX_HIERARCHY_ROWS + 1 }, (_, index) => ({
        id: `member-${index}`,
      })),
    });

    await expect(teamRepo.getTeamMembers('manager-id')).rejects.toMatchObject({
      statusCode: 416,
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WITH RECURSIVE requester');
    expect(sql).toContain('ARRAY[r.id, u.id] AS path');
    expect(sql).toContain('NOT u.id = ANY(t.path)');
    expect(sql).toContain('MIN(t.structural_rank)');
    expect(params).toEqual([
      'manager-id',
      null,
      MAX_HIERARCHY_DEPTH,
      MAX_HIERARCHY_ROWS + 1,
    ]);
  });

  test('department team service forwards a bounded hierarchy limit', async () => {
    const spy = jest
      .spyOn(departmentsRepo, 'getDepartmentTeams')
      .mockResolvedValueOnce([]);

    await departmentsService.getDepartmentTeams('department-id', {
      hierarchyLimit: MAX_HIERARCHY_ROWS + 500,
    });

    expect(spy).toHaveBeenCalledWith('department-id', {
      hierarchyLimit: MAX_HIERARCHY_ROWS,
    });

    spy.mockRestore();
  });

  test('department team rollups cap descendant mappings', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          lead_id: 'lead-id',
          lead_name: 'Lead User',
          role: 'TL',
          member_count: 0,
          tl_count: 0,
          captain_count: 0,
          intern_count: 0,
          mapping_limit_exceeded: false,
        },
      ],
    });

    await expect(
      departmentsRepo.getDepartmentTeams('department-id', {
        hierarchyLimit: 50,
      })
    ).resolves.toEqual([
      {
        lead_id: 'lead-id',
        lead_name: 'Lead User',
        role: 'TL',
        member_count: 0,
        tl_count: 0,
        captain_count: 0,
        intern_count: 0,
      },
    ]);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('WITH RECURSIVE leaders');
    expect(sql).toContain('capped_descendants AS');
    expect(sql).toContain('LIMIT $3');
    expect(sql).toContain('mapping_limit_exceeded');
    expect(params).toEqual(['department-id', MAX_HIERARCHY_DEPTH, 51, 50]);
  });

  test('updateMemberManager blocks cycles with a bounded descendant CTE', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { id: 'member-id', role: 'INTERN' },
          { id: 'manager-id', role: 'CAPTAIN' },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'member-id' }] });

    await expect(
      teamRepo.updateMemberManager('member-id', 'manager-id')
    ).resolves.toEqual({ id: 'member-id' });

    const [cycleSql, cycleParams] = client.query.mock.calls.find(([sql]) =>
      sql.includes('WITH RECURSIVE subordinates')
    );
    expect(cycleSql).toContain('ARRAY[$1::uuid, u.id] AS path');
    expect(cycleSql).toContain('NOT u.id = ANY(s.path)');
    expect(cycleSql).toContain('s.depth < $3');
    expect(cycleParams).toEqual([
      'member-id',
      'manager-id',
      MAX_HIERARCHY_DEPTH,
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
