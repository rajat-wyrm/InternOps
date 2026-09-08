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

async function topPerformers(
  role,
  limit = 10,
  departmentId = null,
  from = null,
  to = null
) {
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
      AND ($3::uuid IS NULL OR u.department_id = $3)
      AND ($4::date IS NULL OR COALESCE(r.rating_period_end,r.created_at::date) >= $4::date)
      AND ($5::date IS NULL OR COALESCE(r.rating_period_end,r.created_at::date) <= $5::date)
    GROUP BY u.id, u.full_name
    ORDER BY avg_rating DESC NULLS LAST
    LIMIT $2
    `,
    [role, limit, departmentId, from, to]
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
      AND a.date >= date_trunc('month', CURRENT_DATE) - make_interval(months => GREATEST($1::int - 1, 0))
      AND ($2::uuid IS NULL OR u.department_id = $2)
    GROUP BY TO_CHAR(a.date,'YYYY-MM'), a.status
    ORDER BY month, a.status
  `,
    [months, departmentId]
  );
  return res.rows;
}

async function getWorkspace({ from, to, departmentId = null }) {
  const datedParams = [from, to, departmentId];
  const departmentParams = [departmentId];
  const datedScope = `u.deleted_at IS NULL AND u.role <> 'ADMIN' AND ($3::uuid IS NULL OR u.department_id = $3)`;
  const departmentScope = `u.deleted_at IS NULL AND u.role <> 'ADMIN' AND ($1::uuid IS NULL OR u.department_id = $1)`;
  const queries = [
    pool.query(
      `SELECT COUNT(*)::int AS total_users, COUNT(*) FILTER (WHERE NOT u.suspended AND COALESCE(u.internship_status,'ACTIVE')='ACTIVE')::int AS active_users FROM users u WHERE ${departmentScope}`,
      departmentParams
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE a.status='PRESENT')::int AS present, COUNT(*) FILTER (WHERE a.status='ABSENT')::int AS absent, COUNT(*) FILTER (WHERE a.status='HALF_DAY')::int AS half_day, ROUND(100.0 * (COUNT(*) FILTER (WHERE a.status='PRESENT') + 0.5 * COUNT(*) FILTER (WHERE a.status='HALF_DAY')) / NULLIF(COUNT(*),0),1)::float AS rate FROM attendance a JOIN users u ON u.id=a.user_id WHERE ${datedScope} AND a.deleted_at IS NULL AND a.date BETWEEN $1::date AND $2::date`,
      datedParams
    ),
    pool.query(
      `SELECT ROUND(AVG(r.score)::numeric,2)::float AS average, COUNT(r.id)::int AS total FROM ratings r JOIN users u ON u.id=r.rated_user_id WHERE ${datedScope} AND r.deleted_at IS NULL AND COALESCE(r.rating_period_end,r.created_at::date) BETWEEN $1::date AND $2::date`,
      datedParams
    ),
    pool.query(
      `SELECT CASE WHEN r.score >= 9 THEN '9-10' WHEN r.score >= 7 THEN '7-8.9' WHEN r.score >= 5 THEN '5-6.9' ELSE 'Below 5' END AS label, COUNT(*)::int AS count FROM ratings r JOIN users u ON u.id=r.rated_user_id WHERE ${datedScope} AND r.deleted_at IS NULL AND COALESCE(r.rating_period_end,r.created_at::date) BETWEEN $1::date AND $2::date GROUP BY label ORDER BY label DESC`,
      datedParams
    ),
    pool.query(
      `SELECT COUNT(DISTINCT st.id)::int AS total_tasks, COUNT(DISTINCT ta.id)::int AS assignments, COUNT(DISTINCT ps.id)::int AS submitted_proofs, COUNT(DISTINCT ps.id) FILTER (WHERE ps.status='VERIFIED')::int AS verified_proofs, COUNT(DISTINCT ps.id) FILTER (WHERE ps.status='PENDING')::int AS pending_proofs, ROUND(100.0 * COUNT(DISTINCT ps.id) FILTER (WHERE ps.status='VERIFIED') / NULLIF(COUNT(DISTINCT ps.id),0),1)::float AS verification_rate FROM social_tasks st LEFT JOIN task_assignments ta ON ta.task_id=st.id AND ta.deleted_at IS NULL LEFT JOIN users u ON u.id=ta.user_id LEFT JOIN proof_submissions ps ON ps.task_id=st.id AND ps.intern_id=u.id AND ps.deleted_at IS NULL WHERE st.deleted_at IS NULL AND st.created_at::date BETWEEN $1::date AND $2::date AND ($3::uuid IS NULL OR u.department_id=$3)`,
      datedParams
    ),
    pool.query(
      `SELECT COALESCE(u.internship_status,'ACTIVE') AS label, COUNT(*)::int AS count FROM users u WHERE ${departmentScope} GROUP BY label ORDER BY count DESC`,
      departmentParams
    ),
    pool.query(
      `SELECT u.role AS label, COUNT(*)::int AS count FROM users u WHERE ${departmentScope} GROUP BY u.role ORDER BY CASE u.role WHEN 'SENIOR_TL' THEN 0 WHEN 'TL' THEN 1 WHEN 'CAPTAIN' THEN 2 WHEN 'INTERN' THEN 3 ELSE 4 END`,
      departmentParams
    ),
    pool.query(
      `WITH member_counts AS (
        SELECT u.department_id, COUNT(*)::int AS members
        FROM users u WHERE ${datedScope} GROUP BY u.department_id
      ), attendance_stats AS (
        SELECT u.department_id, ROUND(100.0 * (COUNT(*) FILTER (WHERE a.status='PRESENT') + 0.5 * COUNT(*) FILTER (WHERE a.status='HALF_DAY')) / NULLIF(COUNT(*),0),1)::float AS attendance_rate
        FROM attendance a JOIN users u ON u.id=a.user_id
        WHERE ${datedScope} AND a.deleted_at IS NULL AND a.date BETWEEN $1::date AND $2::date GROUP BY u.department_id
      ), rating_stats AS (
        SELECT u.department_id, ROUND(AVG(r.score)::numeric,2)::float AS average_rating
        FROM ratings r JOIN users u ON u.id=r.rated_user_id
        WHERE ${datedScope} AND r.deleted_at IS NULL AND COALESCE(r.rating_period_end,r.created_at::date) BETWEEN $1::date AND $2::date GROUP BY u.department_id
      ), task_stats AS (
        SELECT u.department_id, COUNT(DISTINCT st.id)::int AS tasks
        FROM task_assignments ta JOIN users u ON u.id=ta.user_id JOIN social_tasks st ON st.id=ta.task_id
        WHERE ta.deleted_at IS NULL AND st.deleted_at IS NULL AND st.created_at::date BETWEEN $1::date AND $2::date AND ($3::uuid IS NULL OR u.department_id=$3) GROUP BY u.department_id
      ), proof_stats AS (
        SELECT u.department_id, COUNT(DISTINCT ps.id) FILTER (WHERE ps.status='VERIFIED')::int AS verified_proofs
        FROM proof_submissions ps JOIN users u ON u.id=ps.intern_id
        WHERE ps.deleted_at IS NULL AND ps.created_at::date BETWEEN $1::date AND $2::date AND ($3::uuid IS NULL OR u.department_id=$3) GROUP BY u.department_id
      ) SELECT d.id AS department_id, COALESCE(d.name,'Unassigned') AS department_name, mc.members, COALESCE(a.attendance_rate,0) AS attendance_rate, COALESCE(r.average_rating,0) AS average_rating, COALESCE(t.tasks,0) AS tasks, COALESCE(p.verified_proofs,0) AS verified_proofs
      FROM member_counts mc LEFT JOIN departments d ON d.id=mc.department_id AND d.deleted_at IS NULL LEFT JOIN attendance_stats a ON a.department_id=mc.department_id LEFT JOIN rating_stats r ON r.department_id=mc.department_id LEFT JOIN task_stats t ON t.department_id=mc.department_id LEFT JOIN proof_stats p ON p.department_id=mc.department_id ORDER BY mc.members DESC, department_name`,
      datedParams
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE u.joining_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS upcoming_joinings, COUNT(*) FILTER (WHERE COALESCE(u.extended_completion_date,u.completion_date) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS upcoming_completions, COUNT(*) FILTER (WHERE COALESCE(u.internship_status,'ACTIVE')='COMPLETED' AND u.completion_date BETWEEN $1::date AND $2::date)::int AS completed, COUNT(*) FILTER (WHERE COALESCE(u.internship_status,'ACTIVE') IN ('TERMINATED','DISCONTINUED') AND u.lifecycle_effective_date BETWEEN $1::date AND $2::date)::int AS exited FROM users u WHERE ${datedScope}`,
      datedParams
    ),
  ];
  const [
    summary,
    attendance,
    ratings,
    ratingDistribution,
    tasks,
    statuses,
    roles,
    departments,
    lifecycle,
  ] = await Promise.all(queries);
  return {
    summary: summary.rows[0],
    attendance: attendance.rows[0],
    ratings: { ...ratings.rows[0], distribution: ratingDistribution.rows },
    tasks: tasks.rows[0],
    workforce: { statuses: statuses.rows, roles: roles.rows },
    departments: departments.rows,
    lifecycle: lifecycle.rows[0],
  };
}

module.exports = {
  departmentAttendanceRate,
  userCountsByRole,
  topPerformers,
  attendanceTrends,
  getWorkspace,
};
