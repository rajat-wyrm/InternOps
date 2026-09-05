const pool = require('../../src/config/db');
const repo = require('../../src/modules/analytics/repository');

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

describe('Analytics repository', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns the complete workspace contract from scoped aggregate queries', async () => {
    const rows = [
      [{ total_users: 5, active_users: 4 }],
      [{ present: 8, absent: 1, half_day: 1, rate: 85 }],
      [{ average: 4.2, total: 6 }],
      [{ label: '4-5', count: 3 }],
      [
        {
          total_tasks: 2,
          assignments: 4,
          submitted_proofs: 3,
          verified_proofs: 2,
          pending_proofs: 1,
          verification_rate: 66.7,
        },
      ],
      [{ label: 'ACTIVE', count: 4 }],
      [{ label: 'INTERN', count: 4 }],
      [{ department_id: 'd1', department_name: 'Engineering', members: 4 }],
      [
        {
          upcoming_joinings: 1,
          upcoming_completions: 1,
          completed: 1,
          exited: 0,
        },
      ],
    ];
    rows.forEach((value) => pool.query.mockResolvedValueOnce({ rows: value }));
    const result = await repo.getWorkspace({
      from: '2026-01-01',
      to: '2026-09-04',
      departmentId: null,
    });
    expect(result.summary.total_users).toBe(5);
    expect(result.attendance.rate).toBe(85);
    expect(result.ratings.distribution).toHaveLength(1);
    expect(result.tasks.verification_rate).toBe(66.7);
    expect(result.departments[0].department_name).toBe('Engineering');
    expect(pool.query).toHaveBeenCalledTimes(9);
    const calls = pool.query.mock.calls;
    expect(calls[0][1]).toEqual([null]);
    expect(calls[1][1]).toEqual(['2026-01-01', '2026-09-04', null]);
    expect(calls[2][1]).toEqual(['2026-01-01', '2026-09-04', null]);
    expect(calls[3][1]).toEqual(['2026-01-01', '2026-09-04', null]);
    expect(calls[4][1]).toEqual(['2026-01-01', '2026-09-04', null]);
    expect(calls[5][1]).toEqual([null]);
    expect(calls[6][1]).toEqual([null]);
    expect(calls[7][1]).toEqual(['2026-01-01', '2026-09-04', null]);
    expect(calls[8][1]).toEqual(['2026-01-01', '2026-09-04', null]);
    expect(calls[7][0]).toContain('WITH member_counts AS');
    expect(calls[7][0]).toContain('attendance_stats AS');
    expect(calls[7][0]).toContain('rating_stats AS');
    expect(calls[3][0]).toContain("'9-10'");
  });
});
