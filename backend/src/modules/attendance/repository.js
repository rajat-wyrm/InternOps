const pool = require('../../config/db');
const { assertActivityAllowed } = require('../team/lifecycle');
function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

function memberAppliesToRange(member, from, to) {
  const joinedOn = dateOnly(member.joining_date);
  if (joinedOn && joinedOn > to) return false;

  const status = member.internship_status || 'ACTIVE';
  if (status === 'COMPLETED') {
    const completedOn = dateOnly(
      member.extended_completion_date || member.completion_date
    );
    return !completedOn || completedOn >= from;
  }

  if (['TERMINATED', 'DISCONTINUED'].includes(status)) {
    const endedOn = dateOnly(member.lifecycle_effective_date);
    return !endedOn || endedOn >= from;
  }

  return true;
}

async function markAttendance(
  userId,
  markedBy,
  date,
  status,
  remarks,
  client = pool
) {
  await assertActivityAllowed(client, userId, date);
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
  requesterRole,
  from,
  to,
}) {
  const departmentWide = isAdmin || requesterRole === 'SENIOR_TL';
  const memberScope = departmentWide
    ? `SELECT id, full_name, email, intern_code, role, department_id, joining_date::text, internship_status, lifecycle_effective_date::text, completion_date::text, extended_completion_date::text
       FROM users
       WHERE department_id = $1 AND deleted_at IS NULL AND role <> 'ADMIN'`
    : `WITH RECURSIVE visible_users AS (
         SELECT id, full_name, email, intern_code, role, department_id, manager_id, joining_date, internship_status, lifecycle_effective_date, completion_date, extended_completion_date, 0 AS depth
         FROM users
         WHERE id = $2 AND deleted_at IS NULL
         UNION ALL
         SELECT u.id, u.full_name, u.email, u.intern_code, u.role, u.department_id, u.manager_id, u.joining_date, u.internship_status, u.lifecycle_effective_date, u.completion_date, u.extended_completion_date,
                visible_users.depth + 1
         FROM users u
         INNER JOIN visible_users ON u.manager_id = visible_users.id
         WHERE u.deleted_at IS NULL AND visible_users.depth < 100
       )
       SELECT id, full_name, email, intern_code, role, department_id, joining_date::text, internship_status, lifecycle_effective_date::text, completion_date::text, extended_completion_date::text
       FROM visible_users
       WHERE department_id = $1`;

  const memberParams = departmentWide
    ? [departmentId]
    : [departmentId, requesterId];

  const membersResult = await pool.query(memberScope, memberParams);
  const scopedMemberIds = membersResult.rows.map((member) => member.id);
  let availableMonths = [];
  if (scopedMemberIds.length > 0) {
    const availableMonthsResult = await pool.query(
      `SELECT DISTINCT TO_CHAR(a.date, 'YYYY-MM') AS month
       FROM attendance a
       WHERE a.user_id = ANY($1::uuid[])
         AND a.deleted_at IS NULL
       ORDER BY month ASC`,
      [scopedMemberIds]
    );
    availableMonths = availableMonthsResult.rows.map((row) => row.month);
  }
  const members = membersResult.rows
    .filter((member) => memberAppliesToRange(member, from, to))
    .sort((a, b) => {
      const roleOrder = {
        ADMIN: 0,
        SENIOR_TL: 1,
        TL: 2,
        CAPTAIN: 3,
        INTERN: 4,
      };
      const roleDifference =
        (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
      if (roleDifference) return roleDifference;
      return String(a.full_name || a.email || '').localeCompare(
        String(b.full_name || b.email || ''),
        undefined,
        { sensitivity: 'base' }
      );
    });
  const memberIds = members.map((member) => member.id);

  if (memberIds.length === 0) {
    return {
      members: [],
      dates: [],
      records: [],
      available_months: availableMonths,
    };
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
     FROM generate_series($1::date, $2::date, interval '1 day') AS day
     WHERE EXTRACT(ISODOW FROM day) <> 7`,
    [from, to]
  );

  return {
    members,
    dates: datesResult.rows.map((row) => row.date),
    records: recordsResult.rows,
    available_months: availableMonths,
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
    await assertActivityAllowed(client, e.user_id, e.date);
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
async function getAuthorizedSubordinates(
  managerId,
  requesterRole,
  departmentId
) {
  if (requesterRole === 'SENIOR_TL') {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, role FROM users
       WHERE department_id = $1 AND id <> $2 AND role <> 'ADMIN'
         AND deleted_at IS NULL
       ORDER BY CASE role WHEN 'SENIOR_TL' THEN 1 WHEN 'TL' THEN 2
         WHEN 'CAPTAIN' THEN 3 WHEN 'INTERN' THEN 4 ELSE 5 END,
         LOWER(COALESCE(NULLIF(TRIM(full_name), ''), email)), LOWER(email), id`,
      [departmentId, managerId]
    );
    return rows;
  }
  const res = await pool.query(
    `WITH RECURSIVE subordinates AS (
       SELECT id, full_name, email, role, 0 AS depth FROM users WHERE manager_id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT u.id, u.full_name, u.email, u.role, s.depth + 1
       FROM users u
       INNER JOIN subordinates s ON u.manager_id = s.id
       WHERE u.deleted_at IS NULL AND s.depth < 100
     )
     SELECT id, full_name, email, role FROM subordinates
     ORDER BY CASE role
       WHEN 'ADMIN' THEN 0
       WHEN 'SENIOR_TL' THEN 1
       WHEN 'TL' THEN 2
       WHEN 'CAPTAIN' THEN 3
       WHEN 'INTERN' THEN 4
       ELSE 5
     END,
     LOWER(COALESCE(NULLIF(TRIM(full_name), ''), email)),
     LOWER(email), id`,
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
  memberAppliesToRange,
};
