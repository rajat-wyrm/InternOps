const db = require('../../config/db');
const pool = require('../../config/db');
const { MAX_HIERARCHY_DEPTH } = require('../../utils/hierarchy');

class UserRepository {
  constructor(database = db) {
    this.db = database;
  }

  async findPaginated({ page, limit, search, sortBy, sortOrder }) {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params = [];
  if (typeof suspended === 'boolean') {
    params.push(suspended);
    where.push(`users.suspended = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const dataSql = `
    SELECT users.id, users.email, users.role, users.full_name, users.suspended,
           users.avatar_url, users.created_at, users.department_id, users.manager_id,
           departments.name AS department_name
    FROM users
    LEFT JOIN departments ON departments.id = users.department_id
      AND departments.deleted_at IS NULL
    ${whereSql}
    ORDER BY
      CASE role
        WHEN 'ADMIN' THEN 0
        WHEN 'SENIOR_TL' THEN 1
        WHEN 'TL' THEN 2
        WHEN 'CAPTAIN' THEN 3
        WHEN 'INTERN' THEN 4
        ELSE 5
      END,
      LOWER(COALESCE(NULLIF(TRIM(full_name), ''), email)),
      LOWER(email),
      id
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

async function listManageableUserIds(requesterId) {
  const result = await pool.query(
    `WITH RECURSIVE managed AS (
       SELECT u.id, u.manager_id, u.role, u.department_id,
              1 AS depth, ARRAY[$1::uuid, u.id] AS path
       FROM users u
       WHERE u.manager_id = $1 AND u.deleted_at IS NULL
       UNION ALL
       SELECT u.id, u.manager_id, u.role, u.department_id,
              managed.depth + 1, managed.path || u.id
       FROM managed
       JOIN users u
         ON u.manager_id = managed.id
        AND u.deleted_at IS NULL
        AND NOT u.id = ANY(managed.path)
       WHERE managed.depth < $2
     )
     SELECT DISTINCT id FROM managed`,
    [requesterId, MAX_HIERARCHY_DEPTH]
  );
  return result.rows.map((row) => row.id);
}

async function getUserById(id) {
  return pool.query(
    `SELECT users.id, users.email, users.role, users.full_name, users.suspended,
            users.avatar_url, users.created_at, users.department_id, users.manager_id,
            users.phone, users.college, users.course, users.year_of_study, users.position,
            users.intern_code, users.joining_date, users.internship_status, users.location,
            users.notes,
            departments.name AS department_name
     FROM users
     LEFT JOIN departments ON departments.id = users.department_id
       AND departments.deleted_at IS NULL
     WHERE users.id=$1 AND users.deleted_at IS NULL`,
    [id]
  );
}

async function getDepartmentById(id) {
  const result = await pool.query('SELECT id FROM departments WHERE id = $1', [
    id,
  ]);

  return result.rows[0] || null;
}

async function listDepartmentMembers(departmentId) {
  return pool.query(
    `SELECT
  id,
  email,
  role,
  full_name,
  intern_code,
  phone,
  suspended,
  department_id,
  manager_id
     FROM users
     WHERE department_id=$1 AND deleted_at IS NULL AND role <> 'ADMIN'
     ORDER BY CASE role WHEN 'SENIOR_TL' THEN 0 WHEN 'TL' THEN 1 WHEN 'CAPTAIN' THEN 2 ELSE 3 END,
              LOWER(COALESCE(full_name,email))`,
    [departmentId]
  );
}
async function updateHierarchyAssignment({
  userId,
  role,
  departmentId,
  captainIds,
  internIds,
  assignAllCaptains,
  assignAllInterns,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `user-hierarchy:${userId}`,
    ]);

    const targetResult = await client.query(
      'SELECT id,role,department_id,deleted_at,suspended FROM users WHERE id=$1 FOR UPDATE',
      [userId]
    );
    const target = targetResult.rows[0];
    if (!target || target.deleted_at) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    if (target.suspended) {
      throw Object.assign(new Error('A suspended user cannot manage members'), {
        statusCode: 409,
      });
    }
    if (target.role === 'ADMIN' || role === 'ADMIN') {
      throw Object.assign(
        new Error('Admin role is protected and cannot be changed.'),
        { statusCode: 409 }
      );
    }
    if (target.role === 'SENIOR_TL' || role === 'SENIOR_TL') {
      throw Object.assign(
        new Error(
          'Senior TL changes must use Departments → Replace Senior TL.'
        ),
        { statusCode: 409 }
      );
    }
    if (!['TL', 'CAPTAIN'].includes(role)) {
      throw Object.assign(
        new Error(
          'Hierarchy assignments are supported only for TLs and Captains'
        ),
        { statusCode: 400 }
      );
    }

    const department = await client.query(
      'SELECT id FROM departments WHERE id=$1',
      [departmentId]
    );
    if (!department.rowCount) {
      throw Object.assign(new Error('Department not found'), {
        statusCode: 400,
      });
    }

    await client.query(
      'UPDATE users SET role=$1,department_id=$2,updated_at=NOW() WHERE id=$3',
      [role, departmentId, userId]
    );

    let selectedCaptainIds = [
      ...new Set(role === 'TL' ? captainIds || [] : []),
    ].filter((id) => id !== userId);
    let selectedInternIds = [...new Set(internIds || [])].filter(
      (id) => id !== userId
    );

    if (role === 'TL' && assignAllCaptains) {
      const eligibleCaptains = await client.query(
        `SELECT id FROM users
         WHERE department_id=$1 AND role='CAPTAIN' AND suspended=FALSE
           AND deleted_at IS NULL AND id<>$2`,
        [departmentId, userId]
      );
      selectedCaptainIds = eligibleCaptains.rows.map((row) => row.id);
    }

    if (assignAllInterns) {
      const eligibleInterns = await client.query(
        `SELECT id FROM users
         WHERE department_id=$1 AND role='INTERN' AND suspended=FALSE
           AND deleted_at IS NULL AND id<>$2`,
        [departmentId, userId]
      );
      selectedInternIds = eligibleInterns.rows.map((row) => row.id);
    }

    if (search) {
      whereClause = `WHERE (u.name ILIKE $1 OR u.email ILIKE $1)`;
      params.push(`%${search}%`);
    }

    const allowedSortColumns = ['name', 'created_at', 'last_login'];
    const orderColumn = allowedSortColumns.includes(sortBy)
      ? sortBy
      : 'created_at';
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const totalResult = await this.db.query(countQuery, params);
    const total = parseInt(totalResult.rows[0].total, 10);

    const dataQuery = `
      SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login
      FROM users u
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataResult = await this.db.query(dataQuery, [
      ...params,
      limit,
      offset,
    ]);

    return {
      data: dataResult.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id) {
    const result = await this.db.query('SELECT * FROM users WHERE id = $1', [
      id,
    ]);
    return result.rows[0] || null;
  }

  async create(userData) {
    const { name, email, password, role = 'INTERN' } = userData;

    const result = await this.db.query(
      `INSERT INTO users (name, email, password, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, role, created_at`,
      [name, email, password, role]
    );

    return result.rows[0];
  }
  async update(id, updates) {
    const {
      full_name = null,
      email = null,
      role = null,
      department_id = null,
      manager_id = null,
    } = updates;

    const result = await this.db.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           department_id = $4,
           manager_id = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        full_name,
        email ? email.trim().toLowerCase() : null,
        role,
        department_id,
        manager_id,
        id,
      ]
    );

    return result.rows[0] || null;
  }
  async delete(id) {
    const result = await this.db.query(
      `UPDATE users
       SET full_name = 'Removed User',
           email = CONCAT('deleted+', id, '@deleted.local'),
           manager_id = NULL,
           department_id = NULL,
           suspended = TRUE,
           deleted_at = NOW(),
           must_change_password = FALSE
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    return result.rows[0] || null;
  }
}

module.exports = UserRepository;
