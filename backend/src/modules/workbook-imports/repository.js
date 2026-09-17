const pool = require('../../config/db');

async function getExistingInterns(client = pool) {
  const result = await client.query(`
    SELECT id,
           full_name,
           phone,
           email,
           internship_status,
           TO_CHAR(joining_date, 'YYYY-MM-DD') AS joining_date
    FROM users
    WHERE role = 'INTERN'
      AND deleted_at IS NULL
    ORDER BY full_name ASC, id ASC
  `);
  return result.rows;
}

async function getExistingAttendance(userIds, from, to, client = pool) {
  if (!userIds.length || !from || !to) return [];
  const result = await client.query(
    `SELECT user_id,
            TO_CHAR(date, 'YYYY-MM-DD') AS date,
            status,
            remarks
     FROM attendance
     WHERE user_id = ANY($1::uuid[])
       AND date >= $2
       AND date <= $3
       AND deleted_at IS NULL
     ORDER BY user_id ASC, date ASC`,
    [userIds, from, to]
  );
  return result.rows;
}

async function getAccountPlanContext(departmentId, managerId, client = pool) {
  const [departmentResult, managerResult, usersResult] = await Promise.all([
    client.query(
      `SELECT id, name
       FROM departments
       WHERE id = $1 AND deleted_at IS NULL`,
      [departmentId]
    ),
    client.query(
      `SELECT id, full_name, email, role, department_id
       FROM users
       WHERE id = $1
         AND role IN ('SENIOR_TL', 'TL')
         AND deleted_at IS NULL`,
      [managerId]
    ),
    client.query(
      `SELECT id, email, phone, full_name, role, department_id, manager_id
       FROM users
       WHERE deleted_at IS NULL
         AND role = 'INTERN'`
    ),
  ]);
  return {
    department: departmentResult.rows[0] || null,
    manager: managerResult.rows[0] || null,
    existingInterns: usersResult.rows,
  };
}

module.exports = {
  getExistingInterns,
  getExistingAttendance,
  getAccountPlanContext,
};
