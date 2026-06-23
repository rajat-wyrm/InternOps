const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const pool = require('../../config/db');
async function routes(fastify) {
  fastify.get('/', { preHandler: [auth, rbac('ADMIN')] }, async (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const offset = (page - 1) * limit;
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
      data: logs.rows,
      total: Number(totalResult.rows[0].count),
      page,
      limit,
    };
  });
}
module.exports = routes;
