const pool = require('../../config/db');

async function attendanceSummaryByRole(from, to) {
  const res = await pool.query(
    `
    SELECT u.role, a.status, COUNT(*) as count
    FROM attendance a
    JOIN users u ON a.user_id = u.id AND u.deleted_at IS NULL
    WHERE a.date BETWEEN $1 AND $2 AND a.deleted_at IS NULL
    GROUP BY u.role, a.status
  `,
    [from, to]
  );
  return res.rows;
}

async function ratingsSummary(from, to) {
  const res = await pool.query(
    `
    SELECT u.role, AVG(r.score) as avg_score, COUNT(*) as total
    FROM ratings r
    JOIN users u ON r.rated_user_id = u.id AND u.deleted_at IS NULL
    WHERE r.created_at BETWEEN $1 AND $2 AND r.deleted_at IS NULL
    GROUP BY u.role
  `,
    [from, to]
  );
  return res.rows;
}

async function taskCompletionStats() {
  // Count every status (not just VERIFIED/PENDING) so the totals reflect
  // reality. A submission in REJECTED or any future state should still
  // count toward the row total.
  const res = await pool.query(`
    SELECT t.id, t.title,
           COUNT(p.id) FILTER (WHERE p.status='VERIFIED')   AS verified,
           COUNT(p.id) FILTER (WHERE p.status='PENDING')    AS pending,
           COUNT(p.id) FILTER (WHERE p.status='REJECTED')   AS rejected,
           COUNT(p.id) AS total_submissions
    FROM social_tasks t
    LEFT JOIN proof_submissions p ON t.id = p.task_id AND p.deleted_at IS NULL
    WHERE t.deleted_at IS NULL
    GROUP BY t.id, t.title
  `);
  return res.rows;
}

async function departmentAttendance(whereClause, params) {
  const { rows } = await pool.query(
    `SELECT d.name AS department,
            COUNT(a.id) AS total,
            SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN a.status='HALF_DAY' THEN 1 ELSE 0 END) AS half_day
     FROM attendance a
     JOIN users u ON a.user_id = u.id
     LEFT JOIN departments d ON u.department_id = d.id AND d.deleted_at IS NULL
     WHERE ${whereClause}
     GROUP BY d.id, d.name ORDER BY d.name`,
    params
  );
  return rows;
}

async function customSummary(from, to) {
  const { rows } = await pool.query(
    `SELECT DATE(a.date) AS date,
            COUNT(*) AS total,
            SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN a.status='HALF_DAY' THEN 1 ELSE 0 END) AS half_day
     FROM attendance a
     WHERE a.date BETWEEN $1 AND $2
       AND a.deleted_at IS NULL
     GROUP BY DATE(a.date)
     ORDER BY DATE(a.date)`,
    [from, to]
  );
  return rows;
}

module.exports = {
  attendanceSummaryByRole,
  ratingsSummary,
  taskCompletionStats,
  departmentAttendance,
  customSummary,
};
