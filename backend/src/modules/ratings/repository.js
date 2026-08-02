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
  getRatingHistory,
  getRatingsByDepartment,
};
