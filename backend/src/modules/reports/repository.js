const pool = require('../../config/db');

async function attendanceSummaryByRole(from, to, departmentId = null) {
  const res = await pool.query(
    `
    SELECT u.role, a.status, COUNT(*) AS count
    FROM attendance a
    JOIN users u
      ON a.user_id = u.id
      AND u.deleted_at IS NULL
    WHERE a.date BETWEEN $1 AND $2
      AND a.deleted_at IS NULL
      AND ($3::uuid IS NULL OR u.department_id = $3)
    GROUP BY u.role, a.status
    `,
    [from, to, departmentId]
  );
  return res.rows;
}

async function ratingsSummary(from, to, departmentId = null) {
  const res = await pool.query(
    `
    SELECT u.role, AVG(r.score) AS avg_score, COUNT(*) AS total
    FROM ratings r
    JOIN users u
      ON r.rated_user_id = u.id
      AND u.deleted_at IS NULL
    WHERE r.created_at BETWEEN $1 AND $2
      AND r.deleted_at IS NULL
      AND ($3::uuid IS NULL OR u.department_id = $3)
    GROUP BY u.role
    `,
    [from, to, departmentId]
  );
  return res.rows;
}

async function taskCompletionStats(departmentId = null) {
  const res = await pool.query(
    `
    SELECT t.id, t.title,
           COUNT(p.id) FILTER (WHERE p.status='VERIFIED') AS verified,
           COUNT(p.id) FILTER (WHERE p.status='PENDING') AS pending,
           COUNT(p.id) FILTER (WHERE p.status='REJECTED') AS rejected,
           COUNT(p.id) AS total_submissions
    FROM social_tasks t
    LEFT JOIN proof_submissions p
      ON t.id = p.task_id
      AND p.deleted_at IS NULL
    LEFT JOIN users u
      ON u.id = p.intern_id
      AND u.deleted_at IS NULL
    WHERE t.deleted_at IS NULL
      AND ($1::uuid IS NULL OR u.department_id = $1)
    GROUP BY t.id, t.title
    `,
    [departmentId]
  );

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

async function detailedAttendanceExport(departmentId, from, to) {
  const params = [from, to];
  let department = '';
  if (departmentId) {
    params.push(departmentId);
    department = ' AND u.department_id = $3';
  }
  const { rows } = await pool.query(
    `WITH selected_users AS (
      SELECT u.*,
             COALESCE(u.extended_completion_date,u.completion_date) AS effective_completion_date
      FROM users u
      WHERE u.deleted_at IS NULL${department}
    ), lifecycle_markers AS (
      SELECT id,joining_date AS date,'JOINED' AS status FROM selected_users
      WHERE joining_date BETWEEN $1 AND $2
      UNION ALL
      SELECT id,effective_completion_date AS date,'COMPLETED' AS status FROM selected_users
      WHERE internship_status='COMPLETED' AND effective_completion_date BETWEEN $1 AND $2
      UNION ALL
      SELECT id,lifecycle_effective_date AS date,internship_status AS status FROM selected_users
      WHERE internship_status IN ('TERMINATED','DISCONTINUED')
        AND lifecycle_effective_date BETWEEN $1 AND $2
    ), timeline AS (
      SELECT u.full_name,u.email,u.role,COALESCE(u.internship_status,'ACTIVE') AS internship_status,
             a.date::text AS date,a.status::text AS status,a.remarks
      FROM attendance a JOIN selected_users u ON u.id=a.user_id
      WHERE a.deleted_at IS NULL AND a.date BETWEEN $1 AND $2
        AND NOT EXISTS (
          SELECT 1 FROM lifecycle_markers marker
          WHERE marker.id=a.user_id AND marker.date=a.date
        )
      UNION ALL
      SELECT u.full_name,u.email,u.role,COALESCE(u.internship_status,'ACTIVE') AS internship_status,
             marker.date::text AS date,marker.status::text AS status,NULL::text AS remarks
      FROM lifecycle_markers marker JOIN selected_users u ON u.id=marker.id
    )
    SELECT * FROM timeline
    ORDER BY CASE role WHEN 'ADMIN' THEN 0 WHEN 'SENIOR_TL' THEN 1 WHEN 'TL' THEN 2 WHEN 'CAPTAIN' THEN 3 WHEN 'INTERN' THEN 4 ELSE 5 END,
    LOWER(COALESCE(NULLIF(TRIM(full_name),''),email)),date`,
    params
  );
  return rows;
}

module.exports = {
  attendanceSummaryByRole,
  detailedAttendanceExport,
  ratingsSummary,
  taskCompletionStats,
  departmentAttendance,
  customSummary,
};
