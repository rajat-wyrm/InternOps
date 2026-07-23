const pool = require('../../config/db');

async function createDepartment(name, createdBy) {
  try {
    const res = await pool.query(
      'INSERT INTO departments (name, created_by) VALUES ($1,$2) RETURNING *',
      [name, createdBy]
    );
    return res.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Department name already exists');
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

async function getAll() {
  return (
    await pool.query(
      'SELECT * FROM departments WHERE deleted_at IS NULL ORDER BY name'
    )
  ).rows;
}

async function getDepartmentTeams(departmentId) {
  const { rows } = await pool.query(
    `SELECT u.id AS lead_id,
            u.full_name AS lead_name,
            u.role,
            COUNT(r.id)::int AS member_count
     FROM users u
     LEFT JOIN users r
       ON r.manager_id = u.id
      AND r.deleted_at IS NULL
     WHERE u.department_id = $1
       AND u.role IN ('SENIOR_TL', 'TL')
       AND u.deleted_at IS NULL
       AND (u.manager_id IS NULL OR u.manager_id NOT IN (
           SELECT id FROM users WHERE department_id = $1 AND role IN ('SENIOR_TL', 'TL') AND deleted_at IS NULL
       ))
     GROUP BY u.id, u.full_name, u.role
     ORDER BY CASE u.role WHEN 'SENIOR_TL' THEN 0 WHEN 'TL' THEN 1 ELSE 2 END,
              u.full_name`,
    [departmentId]
  );

  return rows;
}

async function deleteDepartment(id, force = false) {
  const { rows } = await pool.query(
    `
    SELECT COUNT(*)::int AS user_count
    FROM users
    WHERE department_id = $1
      AND deleted_at IS NULL
    `,
    [id]
  );

  const userCount = Number(rows[0].user_count);

  if (userCount > 0 && !force) {
    return {
      success: false,
      userCount,
    };
  }

  if (force) {
    await pool.query(
      `
      UPDATE users
      SET department_id = NULL
      WHERE department_id = $1
        AND deleted_at IS NULL
      `,
      [id]
    );
  }

  const result = await pool.query(
    `
    UPDATE departments
    SET deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );

  if (result.rowCount === 0) {
    return {
      success: false,
      userCount: 0,
    };
  }

  return {
    success: true,
    userCount,
  };
}

module.exports = {
  createDepartment,
  getAll,
  getDepartmentTeams,
  deleteDepartment,
};
