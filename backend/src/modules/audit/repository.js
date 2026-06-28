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

module.exports = {
  getAuditLogs,
};
