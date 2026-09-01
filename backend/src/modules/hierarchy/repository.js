const pool = require('../../config/db');
async function getDirectReports(managerId) {
  const res = await pool.query(
    'SELECT id, email, role, full_name, suspended FROM users WHERE manager_id = $1 AND deleted_at IS NULL',
    [managerId]
  );
  return res.rows;
}
async function getFullTeam(userId, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const managerResult = await pool.query(
    `SELECT role, department_id
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  const manager = managerResult.rows[0];

  if (!manager) {
    return { rows: [], total: 0, page, limit };
  }

  if (manager.role === 'SENIOR_TL' && manager.department_id) {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM users
       WHERE department_id = $1
         AND id <> $2
         AND role <> 'ADMIN'
         AND deleted_at IS NULL`,
      [manager.department_id, userId]
    );
    const total = countResult.rows[0].total;
    const dataResult = await pool.query(
      `SELECT id, email, role, full_name, manager_id, 1 AS depth, department_id
       FROM users
       WHERE department_id = $1
         AND id <> $2
         AND role <> 'ADMIN'
         AND deleted_at IS NULL
       ORDER BY
         CASE role
           WHEN 'TL' THEN 1
           WHEN 'CAPTAIN' THEN 2
           WHEN 'INTERN' THEN 3
           ELSE 4
         END,
         LOWER(COALESCE(full_name, email))
       LIMIT $3 OFFSET $4`,
      [manager.department_id, userId, limit, offset]
    );
    return { rows: dataResult.rows, total, page, limit };
  }

  const countQuery = `
    WITH RECURSIVE team AS (
      SELECT id, 0 AS depth FROM users WHERE manager_id = $1 AND deleted_at IS NULL
      UNION ALL
      SELECT u.id, t.depth + 1 FROM users u INNER JOIN team t ON u.manager_id = t.id
      WHERE u.deleted_at IS NULL AND t.depth < 100
    )
    SELECT COUNT(*)::int AS total FROM team
  `;
  const countRes = await pool.query(countQuery, [userId]);
  const total = countRes.rows[0].total;
  if (total > 10000) {
    const err = new Error('Team too large');
    err.statusCode = 416;
    throw err;
  }
  const dataQuery = `
    WITH RECURSIVE team AS (
      SELECT id, email, role, full_name, manager_id, department_id, 1 AS depth
      FROM users WHERE manager_id = $1 AND deleted_at IS NULL
      UNION ALL
      SELECT u.id, u.email, u.role, u.full_name, u.manager_id, u.department_id, t.depth + 1
      FROM users u INNER JOIN team t ON u.manager_id = t.id
      WHERE u.deleted_at IS NULL AND t.depth < 100
    )
    SELECT id, email, role, full_name, manager_id, department_id, depth FROM team
    ORDER BY depth, role, full_name
    LIMIT $2 OFFSET $3
  `;
  const res = await pool.query(dataQuery, [userId, limit, offset]);
  return { rows: res.rows, total, page, limit };
}

async function getUpwardChain(userId) {
  const query = `
    WITH RECURSIVE chain AS (
      SELECT id, email, role, full_name, manager_id, 0 AS depth FROM users WHERE id = $1 AND deleted_at IS NULL
      UNION ALL
      SELECT u.id, u.email, u.role, u.full_name, u.manager_id, c.depth + 1
      FROM users u INNER JOIN chain c ON u.id = c.manager_id
      WHERE u.deleted_at IS NULL AND c.depth < 100
    )
    SELECT id, email, role, full_name FROM chain
  `;
  const res = await pool.query(query, [userId]);
  return res.rows;
}
module.exports = { getDirectReports, getFullTeam, getUpwardChain };
