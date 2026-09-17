const pool = require('../../config/db');

async function getAuditLogs({
  limit,
  isAdmin,
  userId,
  resourceType,
  action,
  search,
  startDate,
  endDate,
  cursor,
}) {
  const conditions = [];
  const params = [];

  if (isAdmin) {
    if (userId) {
      params.push(userId);
      conditions.push(`al.user_id = $${params.length}`);
    }
  } else {
    params.push(userId);
    conditions.push(`al.user_id = $${params.length}`);
  }

  if (resourceType) {
    params.push(resourceType);
    conditions.push(`al.resource_type = $${params.length}`);
  }

  if (action) {
    params.push(`%${action}%`);
    conditions.push(`al.action ILIKE $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const searchIdx1 = params.length;

    params.push(`%${search}%`);
    const searchIdx2 = params.length;

    conditions.push(
      `(u.email ILIKE $${searchIdx1} OR u.full_name ILIKE $${searchIdx2})`
    );
  }

  if (startDate) {
    params.push(startDate);
    conditions.push(`al.created_at >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`al.created_at <= $${params.length}`);
  }

  if (cursor) {
    params.push(cursor.createdAt);
    const createdAtIndex = params.length;

    params.push(cursor.id);
    const idIndex = params.length;

    conditions.push(
      `(al.created_at < $${createdAtIndex}
        OR (
          al.created_at = $${createdAtIndex}
          AND al.id < $${idIndex}
        ))`
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const queryParams = [...params, limit + 1];
  const limitIndex = queryParams.length;

  const logs = await pool.query(
    `SELECT
       al.*,
       u.full_name AS actor_name,
       u.email AS actor_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ${whereClause}
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT $${limitIndex}`,
    queryParams
  );

  const hasNextPage = logs.rows.length > limit;
  const records = hasNextPage ? logs.rows.slice(0, limit) : logs.rows;

  return {
    records,
    hasNextPage,
  };
}

async function logEvent(data) {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    details,
    oldValue,
    newValue,
    ipAddress,
    userAgent,
  } = data || {};

  await pool.query(
    `INSERT INTO audit_logs
      (user_id, action, resource_type, resource_id, details, old_value, new_value, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      userId || null,
      action,
      resourceType || null,
      resourceId || null,
      details ? JSON.stringify(details) : null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress || null,
      userAgent || null,
    ]
  );
}

module.exports = {
  logEvent,
  getAuditLogs,
};
