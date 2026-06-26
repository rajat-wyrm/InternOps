const pool = require('../../config/db');

async function departmentAttendanceRate(
  departmentId,
  month,
  year,
  role = null
) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const params = [departmentId, startDate, endDate];
  let roleClause = '';
  if (role) {
    params.push(role);
    roleClause = `AND u.role = $${params.length}`;
  }

  const res = await pool.query(
    `
    SELECT u.id, u.full_name,
      COUNT(a.id) FILTER (WHERE a.status='PRESENT') as present,
      COUNT(a.id) FILTER (WHERE a.status='ABSENT') as absent,
      COUNT(a.id) FILTER (WHERE a.status='HALF_DAY') as half_day,
      COUNT(a.id) as total_marked
    FROM users u
    LEFT JOIN attendance a ON u.id = a.user_id
      AND a.date >= $2
      AND a.date <  $3
      AND a.deleted_at IS NULL
    WHERE u.department_id = $1
      AND u.deleted_at IS NULL
      ${roleClause}
    GROUP BY u.id, u.full_name
  `,
    params
  );
  return res.rows;
}

async function userCountsByRole() {
  const res = await pool.query(
    `SELECT role, COUNT(*)::int AS count
     FROM users
     WHERE deleted_at IS NULL AND suspended = FALSE
     GROUP BY role`
  );
  return res.rows;
}

async function topPerformers(role, limit = 10) {
  // Do NOT return email — it is unnecessary PII for a leaderboard. Callers
  // that need to contact a user can do so via the existing user API.
  const res = await pool.query(
    `
    SELECT
      u.id,
      u.full_name,
      AVG(r.score) AS avg_rating,
      COUNT(r.id) AS total_ratings
    FROM users u
    LEFT JOIN ratings r
      ON u.id = r.rated_user_id
      AND r.deleted_at IS NULL
    WHERE u.role = $1
      AND u.deleted_at IS NULL
    GROUP BY u.id, u.full_name
    ORDER BY avg_rating DESC NULLS LAST
    LIMIT $2
    `,
    [role, limit]
  );

  return res.rows;
}

// ✅ repository.js — add department scope:
async function attendanceTrends(months = 6, departmentId = null) {
  const res = await pool.query(
    `
    SELECT TO_CHAR(a.date,'YYYY-MM') as month, a.status, COUNT(*) as count
    FROM attendance a
    JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
    WHERE a.deleted_at IS NULL
      AND a.date >= date_trunc('month', CURRENT_DATE) - make_interval(months => $1::int)
      AND ($2::uuid IS NULL OR u.department_id = $2)
    GROUP BY TO_CHAR(a.date,'YYYY-MM'), a.status
    ORDER BY month, a.status
  `,
    [months, departmentId]
  );
  return res.rows;
}

module.exports = {
  departmentAttendanceRate,
  userCountsByRole,
  topPerformers,
  attendanceTrends,
};
