const pool = require('../config/db');

const MAX_HIERARCHY_DEPTH = 8;
const MAX_HIERARCHY_ROWS = 10000;

const ROLE_RANK = {
  ADMIN: 4,
  SENIOR_TL: 3,
  TL: 2,
  CAPTAIN: 1,
  INTERN: 0,
};

function roleRankSql(alias = 'u') {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) {
    throw new Error('Invalid SQL alias for hierarchy role rank');
  }

  return `CASE ${alias}.role
    WHEN 'ADMIN' THEN 0
    WHEN 'SENIOR_TL' THEN 1
    WHEN 'TL' THEN 2
    WHEN 'CAPTAIN' THEN 3
    WHEN 'INTERN' THEN 4
    ELSE 5
  END`;
}

async function checkHierarchyAccess(requesterId, targetUserId, client = pool) {
  if (requesterId === targetUserId) return true;

  const usersRes = await client.query(
    'SELECT id, role, department_id FROM users WHERE id IN ($1, $2) AND deleted_at IS NULL',
    [requesterId, targetUserId]
  );
  if (usersRes.rowCount !== 2) return false;

  const requester = usersRes.rows.find((u) => u.id === requesterId);
  const target = usersRes.rows.find((u) => u.id === targetUserId);

  if (requester.role !== 'ADMIN' && target.role !== 'ADMIN') {
    if (
      !requester.department_id ||
      !target.department_id ||
      requester.department_id !== target.department_id
    ) {
      return false;
    }
    // Senior TL is the department-wide leader. The role can access every
    // non-admin account in the same department without changing manager_id.
    if (requester.role === 'SENIOR_TL') return true;
  }

  const query = `WITH RECURSIVE chain AS (
    SELECT id, manager_id, 0 AS depth, ARRAY[id] AS path
    FROM users
    WHERE id = $1 AND deleted_at IS NULL
    UNION ALL
    SELECT u.id, u.manager_id, chain.depth + 1, chain.path || u.id
    FROM chain
    INNER JOIN users u
      ON u.id = chain.manager_id
     AND u.deleted_at IS NULL
     AND NOT u.id = ANY(chain.path)
    WHERE chain.depth < $3
  ) SELECT 1 FROM chain WHERE id = $2 LIMIT 1`;
  const res = await client.query(query, [
    targetUserId,
    requesterId,
    MAX_HIERARCHY_DEPTH,
  ]);
  return res.rowCount > 0;
}
async function isDirectManager(managerId, subordinateId, client = pool) {
  const res = await client.query('SELECT manager_id FROM users WHERE id = $1', [
    subordinateId,
  ]);
  return res.rows[0]?.manager_id === managerId;
}
function isValidStep(managerRole, subordinateRole) {
  const managerRank = ROLE_RANK[managerRole];
  const subordinateRank = ROLE_RANK[subordinateRole];
  if (managerRank === undefined || subordinateRank === undefined) return false;
  return managerRank > subordinateRank;
}
module.exports = {
  checkHierarchyAccess,
  isDirectManager,
  isValidStep,
  ROLE_RANK,
  MAX_HIERARCHY_DEPTH,
  MAX_HIERARCHY_ROWS,
  roleRankSql,
};
