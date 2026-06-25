const pool = require('../config/db');
async function checkHierarchyAccess(requesterId, targetUserId, client = pool) {
  if (requesterId === targetUserId) return true;

  const usersRes = await pool.query(
    'SELECT id, role, department_id FROM users WHERE id IN ($1, $2)',
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
  }

  const query = `WITH RECURSIVE chain AS (
    SELECT id, manager_id, 0 AS depth FROM users WHERE id = $1 AND deleted_at IS NULL
    UNION ALL
    SELECT u.id, u.manager_id, chain.depth + 1
    FROM users u INNER JOIN chain ON u.id = chain.manager_id
    WHERE u.deleted_at IS NULL AND chain.depth < 100
  ) SELECT 1 FROM chain WHERE id = $2`;
  const res = await client.query(query, [targetUserId, requesterId]);
  return res.rowCount > 0;
}
async function isDirectManager(managerId, subordinateId, client = pool) {
  const res = await client.query('SELECT manager_id FROM users WHERE id = $1', [
    subordinateId,
  ]);
  return res.rows[0]?.manager_id === managerId;
}
const ROLE_RANK = {
  ADMIN: 4,
  SENIOR_TL: 3,
  TL: 2,
  CAPTAIN: 1,
  INTERN: 0,
};
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
};
