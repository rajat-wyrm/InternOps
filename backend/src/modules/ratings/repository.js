const pool = require('../../config/db');

async function addRating(rated, by, score, remarks) {
  const res = await pool.query(
    'INSERT INTO ratings (rated_user_id, rated_by, score, remarks) VALUES ($1,$2,$3,$4) RETURNING *',
    [rated, by, score, remarks]
  );

  return res.rows[0];
}

async function getRatings(userId) {
  const res = await pool.query(
    'SELECT * FROM ratings WHERE rated_user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC',
    [userId]
  );

  return res.rows;
}

async function getDepartmentRatingsSheet({
  departmentId,
  requesterId,
  isAdmin,
  from,
  to,
}) {
  const isAllDepts = !departmentId || departmentId === 'all';
  const memberScope = isAdmin
    ? isAllDepts
      ? `SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.internship_status, d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.deleted_at IS NULL`
      : `SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.internship_status, d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.department_id = $1 AND u.deleted_at IS NULL`
    : isAllDepts
      ? `WITH RECURSIVE visible_users AS (
           SELECT id, full_name, email, role, department_id, manager_id, 0 AS depth
           FROM users
           WHERE id = $1 AND deleted_at IS NULL
           UNION ALL
           SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.manager_id,
                  visible_users.depth + 1
           FROM users u
           INNER JOIN visible_users ON u.manager_id = visible_users.id
           WHERE u.deleted_at IS NULL AND visible_users.depth < 100
         )
         SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.internship_status, d.name AS department_name
         FROM visible_users u
         LEFT JOIN departments d ON d.id = u.department_id`
      : `WITH RECURSIVE visible_users AS (
           SELECT id, full_name, email, role, department_id, manager_id, 0 AS depth
           FROM users
           WHERE id = $2 AND deleted_at IS NULL
           UNION ALL
           SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.manager_id,
                  visible_users.depth + 1
           FROM users u
           INNER JOIN visible_users ON u.manager_id = visible_users.id
           WHERE u.deleted_at IS NULL AND visible_users.depth < 100
         )
         SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.internship_status, d.name AS department_name
         FROM visible_users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.department_id = $1`;

  const memberParams = isAllDepts
    ? isAdmin
      ? []
      : [requesterId]
    : isAdmin
      ? [departmentId]
      : [departmentId, requesterId];
  const membersResult = await pool.query(memberScope, memberParams);
  const members = membersResult.rows;
  const memberIds = members.map((member) => member.id);

  if (memberIds.length === 0) return { members: [] };

  const ratingsResult = await pool.query(
    `SELECT r.rated_user_id, r.score, r.remarks, r.created_at,
            ROW_NUMBER() OVER (
              PARTITION BY r.rated_user_id ORDER BY r.created_at DESC
            ) AS recency
     FROM ratings r
     WHERE r.rated_user_id = ANY($1::uuid[])
       AND r.created_at >= $2::date
       AND r.created_at < ($3::date + interval '1 day')
       AND r.deleted_at IS NULL
     ORDER BY r.created_at DESC`,
    [memberIds, from, to]
  );

  const grouped = new Map();
  for (const row of ratingsResult.rows) {
    if (!grouped.has(row.rated_user_id)) grouped.set(row.rated_user_id, []);
    grouped.get(row.rated_user_id).push(row);
  }

  return {
    members: members.map((member) => {
      const userRatings = grouped.get(member.id) || [];
      const latest = userRatings.find((rating) => Number(rating.recency) === 1);
      const average = userRatings.length
        ? userRatings.reduce((sum, rating) => sum + Number(rating.score), 0) /
          userRatings.length
        : null;

      return {
        ...member,
        average_score: average == null ? null : Number(average.toFixed(1)),
        rating_count: userRatings.length,
        latest_score: latest ? Number(latest.score) : null,
        latest_remarks: latest?.remarks || null,
        latest_created_at: latest?.created_at || null,
      };
    }),
  };
}

async function getRatingHistory(userId) {
  const res = await pool.query(
    'SELECT * FROM ratings WHERE rated_user_id=$1 AND deleted_at IS NULL ORDER BY created_at ASC',
    [userId]
  );

  return res.rows;
}

async function getRatingsByDepartment(deptId) {
  const res = await pool.query(
    `SELECT r.*, u.full_name AS rated_user_name, u.email AS rated_user_email,
            rb.full_name AS rated_by_name, rb.email AS rated_by_email
     FROM ratings r
     JOIN users u ON u.id = r.rated_user_id
     LEFT JOIN users rb ON rb.id = r.rated_by
     WHERE u.department_id = $1 AND r.deleted_at IS NULL
     ORDER BY r.created_at DESC`,
    [deptId]
  );
  return res.rows;
}

module.exports = {
  addRating,
  getRatings,
  getDepartmentRatingsSheet,
  getRatingHistory,
  getRatingsByDepartment,
};
