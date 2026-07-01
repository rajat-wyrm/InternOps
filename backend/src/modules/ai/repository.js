const pool = require('../../config/db');

async function getTodayUsage(userId) {
  const result = await pool.query(
    `
      SELECT successful_requests
      FROM ai_usage
      WHERE user_id = $1
        AND usage_date = CURRENT_DATE
    `,
    [userId]
  );

  return result.rows[0]?.successful_requests || 0;
}

async function incrementUsage(userId) {
  await pool.query(
    `
      INSERT INTO ai_usage (
        user_id,
        usage_date,
        successful_requests
      )
      VALUES (
        $1,
        CURRENT_DATE,
        1
      )

      ON CONFLICT (user_id, usage_date)
      DO UPDATE
      SET
        successful_requests = ai_usage.successful_requests + 1,
        updated_at = NOW()
    `,
    [userId]
  );
}

async function getDailyUsageReport() {
  const result = await pool.query(`
    SELECT
      u.id,
      u.email,
      u.full_name,
      u.role,
      COALESCE(a.successful_requests, 0) AS successful_requests
    FROM users u
    LEFT JOIN ai_usage a
      ON u.id = a.user_id
      AND a.usage_date = CURRENT_DATE
    WHERE u.deleted_at IS NULL
    ORDER BY successful_requests DESC
  `);

  return result.rows;
}

module.exports = {
  getTodayUsage,
  incrementUsage,
  getDailyUsageReport,
};
