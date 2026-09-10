const fs = require('fs');
const path = require('path');

const mockQuery = jest.fn();
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('../../src/config/db', () => ({
  query: (...args) => mockQuery(...args),
  connect: jest.fn().mockResolvedValue(mockClient),
}));

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('mocked_hash'),
}));

const repository = require('../../src/modules/team/repository');

describe('Team Repository - Recursive CTE Depth Guards (#1755)', () => {
  const repoFilePath = path.resolve(
    __dirname,
    '../../src/modules/team/repository.js'
  );
  const repoContent = fs.readFileSync(repoFilePath, 'utf8');

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
  });

  describe('Contract and query structure validation', () => {
    it('1. getTeamMembers contains a bounded recursive CTE with depth column and depth < 100 guard', () => {
      // Base case starts at depth 1
      expect(repoContent).toMatch(
        /team AS \([\s\S]*?1 AS depth[\s\S]*?FROM users/
      );
      // Recursive step increments depth
      expect(repoContent).toMatch(
        /t\.depth \+ 1[\s\S]*?FROM users u INNER JOIN team t/
      );
      // Guard condition
      expect(repoContent).toMatch(/t\.depth < 100/);
    });

    it('2. getPendingProofs contains a bounded recursive CTE with depth column and depth < 100 guard', () => {
      // Base case starts at depth 1
      expect(repoContent).toMatch(
        /team AS \([\s\S]*?SELECT u\.id, 1 AS depth FROM users u/
      );
      // Recursive step increments depth
      expect(repoContent).toMatch(
        /SELECT u\.id, t\.depth \+ 1 FROM users u INNER JOIN team t/
      );
      // Guard condition
      expect(repoContent).toMatch(/t\.depth < 100/);
    });

    it('3. updateMemberManager cycle check contains a bounded recursive CTE with depth column and depth < 100 guard', () => {
      // Base case starts at depth 1
      expect(repoContent).toMatch(
        /subordinates AS \([\s\S]*?SELECT id, 1 AS depth FROM users WHERE manager_id = \$1/
      );
      // Recursive step increments depth
      expect(repoContent).toMatch(
        /SELECT u\.id, s\.depth \+ 1[\s\S]*?FROM users u INNER JOIN subordinates s/
      );
      // Guard condition
      expect(repoContent).toMatch(/s\.depth < 100/);
    });
  });

  describe('Query execution with depth guards', () => {
    it('getTeamMembers passes a query containing "t.depth < 100" to pool.query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repository.getTeamMembers('manager-123', 'dept-456');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('1 AS depth');
      expect(sql).toContain('t.depth + 1');
      expect(sql).toContain('t.depth < 100');
    });

    it('getPendingProofs passes a query containing "t.depth < 100" to pool.query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repository.getPendingProofs('manager-123', 25);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('1 AS depth');
      expect(sql).toContain('t.depth + 1');
      expect(sql).toContain('t.depth < 100');
    });

    it('updateMemberManager cycle-check query contains "s.depth < 100" and "1 AS depth"', async () => {
      // 1. BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // 2. Lock check: return member (INTERN) and manager (TL)
      mockClient.query.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { id: 'intern-1', role: 'INTERN' },
          { id: 'manager-1', role: 'TL' },
        ],
      });
      // 3. Cycle check query: return no cycle
      mockClient.query.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });
      // 4. UPDATE users SET manager_id ...
      mockClient.query.mockResolvedValueOnce({});
      // 5. COMMIT
      mockClient.query.mockResolvedValueOnce({});
      // 6. getMemberById query
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'intern-1', manager_id: 'manager-1' }],
      });

      const res = await repository.updateMemberManager('intern-1', 'manager-1');
      expect(res).toEqual({ id: 'intern-1', manager_id: 'manager-1' });

      // Check the cycle check query (call index 2)
      const cycleSql = mockClient.query.mock.calls[2][0];
      expect(cycleSql).toContain('WITH RECURSIVE subordinates AS');
      expect(cycleSql).toContain('1 AS depth');
      expect(cycleSql).toContain('s.depth + 1');
      expect(cycleSql).toContain('s.depth < 100');
    });

    it('updateMemberManager rejects assignment if a cycle is detected', async () => {
      mockClient.query.mockResolvedValueOnce({}); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { id: 'captain-1', role: 'CAPTAIN' },
          { id: 'tl-1', role: 'TL' },
        ],
      }); // Lock check
      mockClient.query.mockResolvedValueOnce({
        rowCount: 1, // Cycle found!
        rows: [{ '?column?': 1 }],
      });
      mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

      await expect(
        repository.updateMemberManager('captain-1', 'tl-1')
      ).rejects.toThrow('That assignment would create a cycle');

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Regression simulation: pathological deep and cyclic manager hierarchies terminate', () => {
    function simulateRecursiveCTE({
      initialRows,
      getNextRows,
      maxDepthCondition,
    }) {
      let currentLevel = initialRows.map((r) => ({ ...r, depth: 1 }));
      const allResults = [...currentLevel];
      let iterations = 0;
      const MAX_SAFETY_ITERATIONS = 10000;

      while (currentLevel.length > 0) {
        iterations++;
        if (iterations > MAX_SAFETY_ITERATIONS) {
          throw new Error(
            'Infinite recursion detected: exceeded safety iteration limit!'
          );
        }

        const nextLevel = [];
        for (const item of currentLevel) {
          // Check depth condition (e.g. depth < 100)
          if (maxDepthCondition(item.depth)) {
            const children = getNextRows(item);
            for (const child of children) {
              nextLevel.push({ ...child, depth: item.depth + 1 });
            }
          }
        }
        allResults.push(...nextLevel);
        currentLevel = nextLevel;
      }

      return { allResults, iterations };
    }

    it('terminates safely when encountering a cyclic manager chain due to depth cap (< 100)', () => {
      // Pathological cyclic graph: User 1 -> User 2 -> User 3 -> User 1 (cycle)
      const users = [
        { id: 'u1', manager_id: 'u3' },
        { id: 'u2', manager_id: 'u1' },
        { id: 'u3', manager_id: 'u2' },
      ];

      // Unbounded recursion (without depth guard) would run forever:
      expect(() => {
        simulateRecursiveCTE({
          initialRows: users.filter((u) => u.manager_id === 'u1'),
          getNextRows: (curr) => users.filter((u) => u.manager_id === curr.id),
          maxDepthCondition: () => true, // NO depth limit
        });
      }).toThrow('Infinite recursion detected');

      // Bounded recursion with depth < 100 terminates predictably:
      const bounded = simulateRecursiveCTE({
        initialRows: users.filter((u) => u.manager_id === 'u1'),
        getNextRows: (curr) => users.filter((u) => u.manager_id === curr.id),
        maxDepthCondition: (depth) => depth < 100, // s.depth < 100
      });

      expect(bounded.iterations).toBe(100);
      expect(bounded.allResults.length).toBe(100);
      expect(Math.max(...bounded.allResults.map((r) => r.depth))).toBe(100);
    });

    it('terminates safely on a pathological deep (1000-deep) hierarchy without running unbounded', () => {
      // Chain of 1000 users: u0 -> u1 -> u2 -> ... -> u1000
      const users = [];
      for (let i = 1; i <= 1000; i++) {
        users.push({ id: `u${i}`, manager_id: `u${i - 1}` });
      }

      const bounded = simulateRecursiveCTE({
        initialRows: users.filter((u) => u.manager_id === 'u0'),
        getNextRows: (curr) => users.filter((u) => u.manager_id === curr.id),
        maxDepthCondition: (depth) => depth < 100,
      });

      // Does not traverse all 1000 levels; caps cleanly at 100
      expect(bounded.iterations).toBe(100);
      expect(bounded.allResults.length).toBe(100);
      expect(Math.max(...bounded.allResults.map((r) => r.depth))).toBe(100);
    });
  });
});
