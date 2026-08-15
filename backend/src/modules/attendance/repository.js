const pool = require('../../config/db');

async function markAttendance(
  userId,
  markedBy,
  date,
  status,
  remarks,
  client = pool
) {
  const res = await client.query(
    `INSERT INTO attendance (user_id, marked_by, date, status, remarks)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, date)
     DO UPDATE SET status=$4, marked_by=$2, remarks=$5, updated_at=NOW()
     RETURNING *`,
    [userId, markedBy, date, status, remarks || null]
  );

  return res.rows[0];
}

async function getAttendance(userId, { from, to, page = 1, limit = 30 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const where = ['user_id=$1', 'a.deleted_at IS NULL'];
  const params = [userId];

  if (from) {
    params.push(from);
    where.push(`date >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    where.push(`date <= $${params.length}`);
  }

  const whereClause = where.join(' AND ');

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM attendance a WHERE ${whereClause}`,
    params
  );

  const total = countRes.rows[0].total;

  params.push(safeLimit, offset);

  const res = await pool.query(
    `SELECT a.*, m.full_name AS marked_by_name
     FROM attendance a
     LEFT JOIN users m ON m.id = a.marked_by
     WHERE ${whereClause}
     ORDER BY a.date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { records: res.rows, total, page: safePage, limit: safeLimit };
}

async function getDepartmentAttendanceSheet({
  departmentId,
  requesterId,
  isAdmin,
  from,
  to,
}) {
  const memberScope = isAdmin
    ? `SELECT id, full_name, email, role, department_id
       FROM users
       WHERE department_id = $1 AND deleted_at IS NULL`
    : `WITH RECURSIVE visible_users AS (
         SELECT id, full_name, email, role, department_id, manager_id, 0 AS depth
         FROM users
         WHERE id = $2 AND deleted_at IS NULL
         UNION ALL
         SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.manager_id,
                visible_users.depth + 1
         FROM users u
         INNER JOIN visible_users ON u.manager_id = visible_users.id
         WHERE u.deleted_at IS NULL AND visible_users.depth < 100
       )
       SELECT id, full_name, email, role, department_id
       FROM visible_users
       WHERE department_id = $1`;

  const memberParams = isAdmin ? [departmentId] : [departmentId, requesterId];

  const membersResult = await pool.query(memberScope, memberParams);
  const members = membersResult.rows;
  const memberIds = members.map((member) => member.id);

  if (memberIds.length === 0) {
    return { members: [], dates: [], records: [] };
  }

  const recordsResult = await pool.query(
    `SELECT a.id, a.user_id, TO_CHAR(a.date, 'YYYY-MM-DD') AS date, a.status, a.remarks,
            a.marked_by, marker.full_name AS marked_by_name
     FROM attendance a
     LEFT JOIN users marker ON marker.id = a.marked_by
     WHERE a.user_id = ANY($1::uuid[])
       AND a.date >= $2
       AND a.date <= $3
       AND a.deleted_at IS NULL
     ORDER BY a.date ASC, a.user_id ASC`,
    [memberIds, from, to]
  );

  const datesResult = await pool.query(
    `SELECT TO_CHAR(day, 'YYYY-MM-DD') AS date
     FROM generate_series($1::date, $2::date, interval '1 day') AS day`,
    [from, to]
  );

  return {
    members,
    dates: datesResult.rows.map((row) => row.date),
    records: recordsResult.rows,
  };
}

async function getMonthlyStats(userId, month, year) {
  // SARGable date-range form: avoid EXTRACT() on a date column, which would
  // force a sequential scan. With the date range we can use a btree index.
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const res = await pool.query(
    `SELECT status, COUNT(*) as count
     FROM attendance
     WHERE user_id = $1
       AND date >= $2
       AND date <  $3
       AND deleted_at IS NULL
     GROUP BY status`,
    [userId, startDate, endDate]
  );

  return res.rows;
}

async function bulkMark(entries, markedBy, client = pool) {
  const out = [];

  for (const e of entries) {
    const r = await client.query(
      `INSERT INTO attendance (user_id, marked_by, date, status, remarks)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, date)
       DO UPDATE SET status=$4, marked_by=$2, remarks=$5, updated_at=NOW()
       RETURNING *`,
      [e.user_id, markedBy, e.date, e.status, e.remarks || null]
    );

    out.push(r.rows[0]);
  }

  return out;
}

// Returns the set of target ids that fall inside managerId's transitive
// subordinate chain. Replaces per-entry checkHierarchyAccess calls
// (a 1+N query pattern) with a single recursive CTE.
async function listHierarchySubordinates(managerId, targetIds) {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return new Set();
  }

  const res = await pool.query(
    `WITH RECURSIVE chain AS (
       SELECT id, manager_id, 0 AS depth FROM users WHERE id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT u.id, u.manager_id, chain.depth + 1
       FROM users u
       INNER JOIN chain ON u.manager_id = chain.id
       WHERE u.deleted_at IS NULL AND chain.depth < 100
     )
     SELECT id FROM chain WHERE id = ANY($2::uuid[])`,
    [managerId, targetIds]
  );

  return new Set(res.rows.map((r) => r.id));
}

// Add this to your repository.js
async function getAuthorizedSubordinates(managerId) {
  const res = await pool.query(
    `WITH RECURSIVE subordinates AS (
       SELECT id, full_name, email, role, 0 AS depth FROM users WHERE manager_id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT u.id, u.full_name, u.email, u.role, s.depth + 1
       FROM users u
       INNER JOIN subordinates s ON u.manager_id = s.id
       WHERE u.deleted_at IS NULL AND s.depth < 100
     )
     SELECT id, full_name, email, role FROM subordinates`,
    [managerId]
  );
  return res.rows;
}

async function getAnomalies(managerId, isAdmin, filters = {}) {
  const { intern_id, flag_type, viewed } = filters;
  let query = `
    SELECT a.*, 
           u.full_name AS intern_name, 
           u.email AS intern_email,
           v.full_name AS viewed_by_name
    FROM attendance_anomalies a
    JOIN users u ON u.id = a.intern_id
    LEFT JOIN users v ON v.id = a.viewed_by
    WHERE 1=1
  `;
  const params = [];

  if (!isAdmin) {
    params.push(managerId);
    query += ` AND a.intern_id IN (
      WITH RECURSIVE subordinates AS (
        SELECT id, 0 AS depth FROM users WHERE manager_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT u.id, s.depth + 1
        FROM users u
        INNER JOIN subordinates s ON u.manager_id = s.id
        WHERE u.deleted_at IS NULL AND s.depth < 100
      )
      SELECT id FROM subordinates
    )`;
  }

  if (intern_id) {
    params.push(intern_id);
    query += ` AND a.intern_id = $${params.length}`;
  }

  if (flag_type) {
    params.push(flag_type);
    query += ` AND a.flag_type = $${params.length}`;
  }

  if (viewed !== undefined) {
    if (viewed) {
      query += ` AND a.viewed_at IS NOT NULL`;
    } else {
      query += ` AND a.viewed_at IS NULL`;
    }
  }

  query += ` ORDER BY a.created_at DESC`;

  const res = await pool.query(query, params);
  return res.rows;
}

async function markAnomalyViewed(anomalyId, managerId, isAdmin) {
  if (!isAdmin) {
    const checkRes = await pool.query(
      `SELECT intern_id FROM attendance_anomalies WHERE id = $1`,
      [anomalyId]
    );
    if (checkRes.rows.length === 0) {
      throw new Error('Anomaly not found');
    }
    const internId = checkRes.rows[0].intern_id;
    const subordinates = await getAuthorizedSubordinates(managerId);
    const subIds = new Set(subordinates.map((s) => s.id));
    if (!subIds.has(internId)) {
      throw new Error('Access denied: Intern is not in your hierarchy');
    }
  }

  const res = await pool.query(
    `UPDATE attendance_anomalies
     SET viewed_by = $1, viewed_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [managerId, anomalyId]
  );

  if (res.rows.length === 0) {
    throw new Error('Anomaly not found');
  }

  return res.rows[0];
}

module.exports = {
  markAttendance,
  getAttendance,
  getDepartmentAttendanceSheet,
  getMonthlyStats,
  bulkMark,
  listHierarchySubordinates,
  getAuthorizedSubordinates,
  getAnomalies,
  markAnomalyViewed,
};
