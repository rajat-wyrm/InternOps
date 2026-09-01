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
  departmentId,
  filterDepartmentId,
}) {
  const where = ['users.deleted_at IS NULL'];
  const params = [];

  if (departmentId) {
    params.push(departmentId);
    where.push(`users.department_id = $${params.length}`);
  }
  if (filterDepartmentId === 'unassigned') {
    where.push('users.department_id IS NULL');
  } else if (filterDepartmentId) {
    params.push(filterDepartmentId);
    where.push(`users.department_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(users.full_name ILIKE $${params.length} OR users.email ILIKE $${params.length})`
    );
  }

  if (role) {
    params.push(role);
    where.push(`users.role = $${params.length}`);
  }

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
       SELECT id, manager_id, role, department_id, 0 AS depth
       FROM users
       WHERE manager_id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT u.id, u.manager_id, u.role, u.department_id, managed.depth + 1
       FROM users u
       JOIN managed ON u.manager_id = managed.id
       WHERE u.deleted_at IS NULL AND managed.depth < 100
     )
     SELECT DISTINCT id FROM managed`,
    [requesterId]
  );
  return result.rows.map((row) => row.id);
}

async function getUserById(id) {
  return pool.query(
    `SELECT users.id, users.email, users.role, users.full_name, users.suspended,
            users.avatar_url, users.created_at, users.department_id, users.manager_id,
            users.phone, users.college, users.course, users.year_of_study, users.position,
            users.joining_date, users.internship_status, users.location, users.notes,
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

    if (selectedCaptainIds.length) {
      const eligibleCaptains = await client.query(
        `SELECT id FROM users
         WHERE id=ANY($1::uuid[]) AND department_id=$2 AND role='CAPTAIN'
           AND suspended=FALSE AND deleted_at IS NULL FOR UPDATE`,
        [selectedCaptainIds, departmentId]
      );
      if (eligibleCaptains.rowCount !== selectedCaptainIds.length) {
        throw Object.assign(
          new Error(
            'Only active Captains from the same department can be assigned to a TL'
          ),
          { statusCode: 400 }
        );
      }
      await client.query(
        'UPDATE users SET manager_id=$1,updated_at=NOW() WHERE id=ANY($2::uuid[])',
        [userId, selectedCaptainIds]
      );
    }

    if (selectedInternIds.length) {
      const eligibleInterns = await client.query(
        `SELECT id FROM users
         WHERE id=ANY($1::uuid[]) AND department_id=$2 AND role='INTERN'
           AND suspended=FALSE AND deleted_at IS NULL FOR UPDATE`,
        [selectedInternIds, departmentId]
      );
      if (eligibleInterns.rowCount !== selectedInternIds.length) {
        throw Object.assign(
          new Error(
            'Only active Interns from the same department can be assigned'
          ),
          { statusCode: 400 }
        );
      }
      await client.query(
        'UPDATE users SET manager_id=$1,updated_at=NOW() WHERE id=ANY($2::uuid[])',
        [userId, selectedInternIds]
      );
    }

    await client.query('COMMIT');
    return {
      success: true,
      assignedCaptainCount: selectedCaptainIds.length,
      assignedInternCount: selectedInternIds.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
async function countDirectReports(id) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS total FROM users WHERE manager_id=$1 AND deleted_at IS NULL',
    [id]
  );
  return result.rows[0].total;
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

async function safelyRemoveUser(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const targetResult = await client.query(
      `SELECT id, email, full_name, role, department_id, manager_id
       FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    const target = targetResult.rows[0];
    if (!target) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      'UPDATE users SET manager_id=$1,updated_at=NOW() WHERE manager_id=$2 AND deleted_at IS NULL',
      [target.manager_id || null, id]
    );
    await client.query('DELETE FROM notifications WHERE user_id=$1', [id]);
    await client.query('DELETE FROM refresh_tokens WHERE user_id=$1', [id]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [
      id,
    ]);
    await client.query('DELETE FROM email_verifications WHERE user_id=$1', [
      id,
    ]);
    const removedEmail = `removed+${id}@deleted.invalid`;
    await client.query(
      `UPDATE users SET email=$1,full_name='Removed User',phone=NULL,college=NULL,
       course=NULL,year_of_study=NULL,position=NULL,internship_domain=NULL,
       offer_letter_url=NULL,location=NULL,notes=NULL,avatar_url=NULL,
       intern_code=NULL,manager_id=NULL,department_id=NULL,suspended=TRUE,
       deleted_at=NOW(),updated_at=NOW() WHERE id=$2`,
      [removedEmail, id]
    );
    await client.query('COMMIT');
    return { ...target, removedEmail };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
  listManageableUserIds,
  getUserById,
  getDepartmentById,
  countDirectReports,
  listDepartmentMembers,
  updateHierarchyAssignment,
  updateUser,
  suspendUser,
  activateUser,
  safelyRemoveUser,
  countOtherActiveAdmins,
};
