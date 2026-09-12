const pool = require('../../config/db');
const {
  MAX_HIERARCHY_DEPTH,
  MAX_HIERARCHY_ROWS,
  roleRankSql,
} = require('../../utils/hierarchy');

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
       FROM users u
       WHERE u.department_id = $1
         AND u.id <> $2
         AND u.role <> 'ADMIN'
         AND u.deleted_at IS NULL`,
      [manager.department_id, userId]
    );
    const total = countResult.rows[0].total;
    const dataResult = await pool.query(
      `SELECT u.id, u.email, u.role, u.full_name, u.manager_id, 1 AS depth, u.department_id
       FROM users u
       WHERE u.department_id = $1
         AND u.id <> $2
         AND u.role <> 'ADMIN'
         AND u.deleted_at IS NULL
       ORDER BY
         ${roleRankSql('u')},
         LOWER(COALESCE(NULLIF(TRIM(u.full_name), ''), u.email)),
         LOWER(u.email),
         u.id
       LIMIT $3 OFFSET $4`,
      [manager.department_id, userId, limit, offset]
    );
    return { rows: dataResult.rows, total, page, limit };
  }

  const countQuery = `
    WITH RECURSIVE team AS (
      SELECT u.id, u.manager_id, 1 AS depth, ARRAY[$1::uuid, u.id] AS path
      FROM users u
      WHERE u.manager_id = $1 AND u.deleted_at IS NULL
      UNION ALL
      SELECT u.id, u.manager_id, t.depth + 1, t.path || u.id
      FROM team t
      INNER JOIN users u
        ON u.manager_id = t.id
       AND u.deleted_at IS NULL
       AND NOT u.id = ANY(t.path)
      WHERE t.depth < $2
    )
    SELECT COUNT(*)::int AS total FROM team
  `;
  const countRes = await pool.query(countQuery, [userId, MAX_HIERARCHY_DEPTH]);
  const total = countRes.rows[0].total;
  if (total > MAX_HIERARCHY_ROWS) {
    const err = new Error('Team too large');
    err.statusCode = 416;
    throw err;
  }
  const dataQuery = `
    WITH RECURSIVE team AS (
      SELECT u.id, u.email, u.role, u.full_name, u.manager_id, u.department_id,
             1 AS depth, ARRAY[$1::uuid, u.id] AS path,
             ${roleRankSql('u')} AS structural_rank
      FROM users u
      WHERE u.manager_id = $1 AND u.deleted_at IS NULL
      UNION ALL
      SELECT u.id, u.email, u.role, u.full_name, u.manager_id, u.department_id,
             t.depth + 1, t.path || u.id,
             ${roleRankSql('u')} AS structural_rank
      FROM team t
      INNER JOIN users u
        ON u.manager_id = t.id
       AND u.deleted_at IS NULL
       AND NOT u.id = ANY(t.path)
      WHERE t.depth < $4
    )
    SELECT id, email, role, full_name, manager_id, department_id, depth FROM team
    ORDER BY
      depth,
      structural_rank,
      LOWER(COALESCE(NULLIF(TRIM(full_name), ''), email)),
      LOWER(email),
      id
    LIMIT $2 OFFSET $3
  `;
  const res = await pool.query(dataQuery, [
    userId,
    limit,
    offset,
    MAX_HIERARCHY_DEPTH,
  ]);
  return { rows: res.rows, total, page, limit };
}

async function getUpwardChain(userId) {
  const query = `
    WITH RECURSIVE chain AS (
      SELECT u.id, u.email, u.role, u.full_name, u.manager_id,
             0 AS depth, ARRAY[u.id] AS path,
             ${roleRankSql('u')} AS structural_rank
      FROM users u
      WHERE u.id = $1 AND u.deleted_at IS NULL
      UNION ALL
      SELECT u.id, u.email, u.role, u.full_name, u.manager_id,
             c.depth + 1, c.path || u.id,
             ${roleRankSql('u')} AS structural_rank
      FROM chain c
      INNER JOIN users u
        ON u.id = c.manager_id
       AND u.deleted_at IS NULL
       AND NOT u.id = ANY(c.path)
      WHERE c.depth < $2
    )
    SELECT id, email, role, full_name FROM chain
    ORDER BY depth, structural_rank, LOWER(COALESCE(NULLIF(TRIM(full_name), ''), email)), LOWER(email), id
  `;
  const res = await pool.query(query, [userId, MAX_HIERARCHY_DEPTH]);
  return res.rows;
}
module.exports = { getDirectReports, getFullTeam, getUpwardChain };
