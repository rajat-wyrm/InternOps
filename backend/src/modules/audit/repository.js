const pool = require('../../config/db');

async function getAuditLogs(limit, offset) {
  const logs = await pool.query(
    `
    SELECT al.*, u.full_name AS actor_name, u.email AS actor_email
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );
  const totalResult = await pool.query('SELECT COUNT(*) FROM audit_logs');
  return {
    records: logs.rows,
    total: Number(totalResult.rows[0].count),
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
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, old_value, new_value, ip_address, user_agent)
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
  getAuditLogs,
  logEvent,
};
