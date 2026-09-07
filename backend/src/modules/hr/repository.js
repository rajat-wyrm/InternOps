const pool = require('../../config/db');

async function getDashboard({
  search = '',
  departmentId = null,
  status = null,
  issue = null,
}) {
  const params = [];
  const where = ['u.deleted_at IS NULL', "u.role <> 'ADMIN'"];
  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.intern_code ILIKE $${params.length})`
    );
  }
  if (departmentId) {
    params.push(departmentId);
    where.push(`u.department_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`COALESCE(u.internship_status,'ACTIVE') = $${params.length}`);
  }
  if (issue === 'missing-document')
    where.push("NULLIF(TRIM(COALESCE(u.offer_letter_url,'')), '') IS NULL");
  if (issue === 'missing-phone')
    where.push("NULLIF(TRIM(COALESCE(u.phone,'')), '') IS NULL");
  if (issue === 'missing-department') where.push('u.department_id IS NULL');
  if (issue === 'overdue')
    where.push(
      "COALESCE(u.extended_completion_date,u.completion_date) < CURRENT_DATE AND COALESCE(u.internship_status,'ACTIVE') = 'ACTIVE'"
    );
  const filter = `WHERE ${where.join(' AND ')}`;
  const summaryQuery = `SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE NOT u.suspended AND COALESCE(u.internship_status,'ACTIVE')='ACTIVE')::int AS active,
    COUNT(*) FILTER (WHERE COALESCE(u.internship_status,'ACTIVE')='ON_HOLD')::int AS on_hold,
    COUNT(*) FILTER (WHERE COALESCE(u.internship_status,'ACTIVE')='COMPLETED')::int AS completed,
    COUNT(*) FILTER (WHERE COALESCE(u.internship_status,'ACTIVE') IN ('TERMINATED','DISCONTINUED'))::int AS exited,
    COUNT(*) FILTER (WHERE u.suspended)::int AS suspended,
    COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(u.offer_letter_url,'')), '') IS NULL)::int AS missing_documents,
    COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(u.phone,'')), '') IS NULL OR u.department_id IS NULL OR u.joining_date IS NULL)::int AS incomplete_profiles,
    COUNT(*) FILTER (WHERE u.joining_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS upcoming_joinings,
    COUNT(*) FILTER (WHERE COALESCE(u.extended_completion_date,u.completion_date) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS upcoming_completions,
    COUNT(*) FILTER (WHERE COALESCE(u.extended_completion_date,u.completion_date) < CURRENT_DATE AND COALESCE(u.internship_status,'ACTIVE')='ACTIVE')::int AS overdue_active
    FROM users u ${filter}`;
  const directoryQuery = `SELECT u.id,u.full_name,u.email,u.role,u.phone,u.intern_code,u.internship_domain,u.position,
    u.joining_date::text,u.completion_date::text,u.extended_completion_date::text,u.lifecycle_effective_date::text,
    COALESCE(u.internship_status,'ACTIVE') AS internship_status,u.suspended,u.offer_letter_url,u.department_id,d.name AS department_name
    FROM users u LEFT JOIN departments d ON d.id=u.department_id AND d.deleted_at IS NULL ${filter}
    ORDER BY COALESCE(u.extended_completion_date,u.completion_date) NULLS LAST,LOWER(COALESCE(u.full_name,u.email)) LIMIT 250`;
  const roleQuery = `SELECT u.role AS label,COUNT(*)::int AS count FROM users u ${filter} GROUP BY u.role ORDER BY count DESC`;
  const departmentQuery = `SELECT COALESCE(d.name,'Unassigned') AS label,COUNT(*)::int AS count FROM users u LEFT JOIN departments d ON d.id=u.department_id AND d.deleted_at IS NULL ${filter} GROUP BY COALESCE(d.name,'Unassigned') ORDER BY count DESC,label`;
  const milestoneQuery = `SELECT u.id,u.full_name,u.email,u.role,d.name AS department_name,u.joining_date::text,u.completion_date::text,u.extended_completion_date::text,COALESCE(u.internship_status,'ACTIVE') AS internship_status
    FROM users u LEFT JOIN departments d ON d.id=u.department_id AND d.deleted_at IS NULL
    WHERE u.deleted_at IS NULL AND u.role <> 'ADMIN' AND (u.joining_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days' OR COALESCE(u.extended_completion_date,u.completion_date) BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE + INTERVAL '45 days')
    ORDER BY LEAST(COALESCE(u.joining_date,'infinity'::date),COALESCE(u.extended_completion_date,u.completion_date,'infinity'::date)) LIMIT 40`;
  const [summary, directory, roles, departments, milestones] =
    await Promise.all([
      pool.query(summaryQuery, params),
      pool.query(directoryQuery, params),
      pool.query(roleQuery, params),
      pool.query(departmentQuery, params),
      pool.query(milestoneQuery),
    ]);
  return {
    summary: summary.rows[0],
    directory: directory.rows,
    roles: roles.rows,
    departments: departments.rows,
    milestones: milestones.rows,
  };
}
module.exports = { getDashboard };
