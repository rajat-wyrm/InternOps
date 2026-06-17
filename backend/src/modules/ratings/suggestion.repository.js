const pool = require('../../config/db');

async function getUser(userId) {
  const result = await pool.query(
    `
    SELECT
      id,
      full_name,
      created_at,
      role
    FROM users
    WHERE id = $1
      AND deleted_at IS NULL
    `,
    [userId]
  );

  return result.rows[0];
}

async function getAttendanceSummary(userId) {
  const result = await pool.query(
    `
    SELECT
      COUNT(*) AS total_days,
      COUNT(*) FILTER (WHERE status = 'PRESENT') AS present_days,
      COUNT(*) FILTER (WHERE status = 'ABSENT') AS absent_days,
      COUNT(*) FILTER (WHERE status = 'HALF_DAY') AS half_days
    FROM attendance
    WHERE user_id = $1
      AND deleted_at IS NULL
      AND date >= CURRENT_DATE - INTERVAL '30 days'
    `,
    [userId]
  );

  return result.rows[0];
}

async function getTaskSummary(userId) {
  const result = await pool.query(
    `
    SELECT
      COUNT(*) AS submitted,
      COUNT(*) FILTER (WHERE status = 'VERIFIED') AS verified
    FROM proof_submissions
    WHERE intern_id = $1
      AND deleted_at IS NULL
    `,
    [userId]
  );

  return result.rows[0];
}

async function getRatingHistory(userId) {
  const result = await pool.query(
    `
    SELECT
      score,
      created_at
    FROM ratings
    WHERE rated_user_id = $1
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 3
    `,
    [userId]
  );

  return result.rows;
}

module.exports = {
  getUser,
  getAttendanceSummary,
  getTaskSummary,
  getRatingHistory,
};
