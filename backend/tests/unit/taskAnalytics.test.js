const pool = require('../../src/config/db');
const repo = require('../../src/modules/social-tasks/repository');

jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

describe('Task Analytics Repository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns null if task is not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // getTaskById

    const res = await repo.getTaskAnalytics(
      '00000000-0000-0000-0000-000000000000'
    );
    expect(res).toBeNull();
  });

  it('calculates overall and department-wise metrics accurately', async () => {
    const mockTask = {
      id: 'task-123',
      title: 'LinkedIn Growth Campaign',
      target_platform: 'LinkedIn',
      deadline: '2026-08-30T18:30:00.000Z',
    };

    const mockDepartments = [
      { id: 'dept-1', name: 'Frontend Engineering' },
      { id: 'dept-2', name: 'Backend Engineering' },
      { id: 'dept-3', name: 'Marketing' },
    ];

    const mockInterns = [
      {
        id: 'user-1',
        full_name: 'Alice',
        email: 'alice@internops.com',
        department_id: 'dept-1',
        department_name: 'Frontend Engineering',
        position: 'React Intern',
        proof_id: 'proof-1',
        proof_status: 'VERIFIED',
        submitted_at: '2026-08-27T10:00:00.000Z',
        images: [{ id: 'img-1', image_path: 'uploads/proof1.png' }],
      },
      {
        id: 'user-2',
        full_name: 'Bob',
        email: 'bob@internops.com',
        department_id: 'dept-1',
        department_name: 'Frontend Engineering',
        position: 'React Intern',
        proof_id: 'proof-2',
        proof_status: 'PENDING',
        submitted_at: '2026-08-27T11:00:00.000Z',
        images: [],
      },
      {
        id: 'user-3',
        full_name: 'Charlie',
        email: 'charlie@internops.com',
        department_id: 'dept-2',
        department_name: 'Backend Engineering',
        position: 'Node Intern',
        proof_id: null,
        proof_status: null,
        submitted_at: null,
        images: [],
      },
    ];

    // Mock query calls
    pool.query
      .mockResolvedValueOnce({ rows: [mockTask] }) // getTaskById
      .mockResolvedValueOnce({ rows: mockDepartments }) // departments list
      .mockResolvedValueOnce({ rows: mockInterns }); // interns + proofs query

    const res = await repo.getTaskAnalytics('task-123');

    expect(res).toBeDefined();
    expect(res.task.id).toBe('task-123');

    // Summary checks
    expect(res.summary.total_interns).toBe(3);
    expect(res.summary.verified_count).toBe(1);
    expect(res.summary.pending_count).toBe(1);
    expect(res.summary.not_submitted_count).toBe(1);
    // Completion rate = 1 / 3 = 33%
    expect(res.summary.completion_rate).toBe(33);

    // Department Stats checks
    const frontendDept = res.departmentStats.find(
      (d) => d.department_id === 'dept-1'
    );
    expect(frontendDept).toBeDefined();
    expect(frontendDept.total_interns).toBe(2);
    expect(frontendDept.verified_count).toBe(1);
    expect(frontendDept.pending_count).toBe(1);
    expect(frontendDept.not_submitted_count).toBe(0);
    expect(frontendDept.completion_rate).toBe(50);

    const backendDept = res.departmentStats.find(
      (d) => d.department_id === 'dept-2'
    );
    expect(backendDept).toBeDefined();
    expect(backendDept.total_interns).toBe(1);
    expect(backendDept.verified_count).toBe(0);
    expect(backendDept.not_submitted_count).toBe(1);
    expect(backendDept.completion_rate).toBe(0);

    // Interns list check
    expect(res.interns).toHaveLength(3);
    expect(res.interns[0].full_name).toBe('Alice');
    expect(res.interns[0].proof_status).toBe('VERIFIED');
  });
});
