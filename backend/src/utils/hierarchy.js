const pool = require('../config/db');
async function checkHierarchyAccess(requesterId, targetUserId) {
  if (requesterId === targetUserId) return true;
  const query = `WITH RECURSIVE chain AS (
    SELECT id, manager_id FROM users WHERE id = $1
    UNION ALL
    SELECT u.id, u.manager_id FROM users u INNER JOIN chain ON u.id = chain.manager_id
  ) SELECT 1 FROM chain WHERE id = $2`;
  const res = await pool.query(query, [targetUserId, requesterId]);
  return res.rowCount > 0;
}
async function isDirectManager(managerId, subordinateId) {
  const res = await pool.query('SELECT manager_id FROM users WHERE id = $1', [
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
