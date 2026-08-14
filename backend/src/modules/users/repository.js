const pool = require('../../config/db');

const EDITABLE_USER_COLUMNS = new Set([
  'full_name',
  'email',
  'role',
  'department_id',
  'manager_id',
]);

async function listUsersByRole(role) {
  return pool.query(
    'SELECT id,email,role,full_name,suspended FROM users WHERE deleted_at IS NULL AND role=$1',
    [role]
  );
}

async function listUsersPaginated({
  role,
  suspended,
  search,
  page,
  limit,
  offset,
}) {
  const where = ['deleted_at IS NULL'];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`
    );
  }

  if (role) {
    params.push(role);
    where.push(`role = $${params.length}`);
  }

  if (typeof suspended === 'boolean') {
    params.push(suspended);
    where.push(`suspended = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const dataSql = `
    SELECT id, email, role, full_name, suspended, avatar_url, created_at,
           department_id, manager_id
    FROM users
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM users
    ${whereSql}
  `;

  const [dataRes, countRes] = await Promise.all([
    pool.query(dataSql, [...params, limit, offset]),
    pool.query(countSql, params),
  ]);

  return {
    data: dataRes.rows,
    total: countRes.rows[0].total,
    page,
    limit,
  };
}

async function getUserById(id) {
  return pool.query(
    `SELECT id, email, role, full_name, suspended, avatar_url, created_at,
            department_id, manager_id, phone, college, course, year_of_study, position,
            joining_date, internship_status, location, notes
     FROM users WHERE id=$1 AND deleted_at IS NULL`,
    [id]
  );
}

async function getDepartmentById(id) {
  const result = await pool.query('SELECT id FROM departments WHERE id = $1', [
    id,
  ]);

  return result.rows[0] || null;
}

async function updateUser(id, data) {
  const fields = [];
  const params = [];

  for (const [column, value] of Object.entries(data)) {
    if (!EDITABLE_USER_COLUMNS.has(column)) {
      throw new Error(`Unsupported user update field: ${column}`);
    }

    params.push(value);
    fields.push(`${column} = $${params.length}`);
  }

  if (fields.length === 0) return null;

  params.push(id);
  const result = await pool.query(
    `UPDATE users
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length} AND deleted_at IS NULL
     RETURNING id, email, role, full_name, suspended, avatar_url, created_at,
               department_id, manager_id, updated_at`,
    params
  );

  return result.rows[0] || null;
}

async function suspendUser(id) {
  await pool.query(
    'UPDATE users SET suspended=TRUE, updated_at=NOW() WHERE id=$1',
    [id]
  );
}

async function activateUser(id) {
  await pool.query(
    'UPDATE users SET suspended=FALSE, updated_at=NOW() WHERE id=$1',
    [id]
  );
}

async function softDeleteUser(id) {
  await pool.query(
    'UPDATE users SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1',
    [id]
  );
}

async function countOtherActiveAdmins(id) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM users
     WHERE role = 'ADMIN'
       AND suspended = FALSE
       AND deleted_at IS NULL
       AND id != $1`,
    [id]
  );

  return result.rows[0].total;
}

module.exports = {
  listUsersByRole,
  listUsersPaginated,
  getUserById,
  getDepartmentById,
  updateUser,
  suspendUser,
  activateUser,
  softDeleteUser,
  countOtherActiveAdmins,
};
