const auth = require('../../middleware/auth');
const pool = require('../../config/db');
const { z } = require('zod');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  resourceType: z.string().trim().max(100).optional(),
});

async function routes(fastify) {
  fastify.get('/', { preHandler: [auth] }, async (req, reply) => {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.issues,
      });
    }

    const { page, limit, userId, resourceType } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.user.role === 'ADMIN') {
      if (userId) {
        params.push(userId);
        conditions.push(`al.user_id = $${params.length}`);
      }
    } else {
      params.push(req.user.id);
      conditions.push(`al.user_id = $${params.length}`);
    }

    if (resourceType) {
      params.push(resourceType);
      conditions.push(`al.resource_type = $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Fetch total matching records for pagination
    const totalResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
      params
    );
    const total = Number(totalResult.rows[0].count);

    // Fetch matching data
    const dataParams = [...params, limit, offset];
    const limitIndex = dataParams.length - 1;
    const offsetIndex = dataParams.length;

    const logs = await pool.query(
      `
      SELECT al.*, u.full_name AS actor_name, u.email AS actor_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `,
      dataParams
    );

    // Strip ip_address and user_agent for non-admins if the log is not their own
    const data = logs.rows.map((row) => {
      if (req.user.role !== 'ADMIN' && row.user_id !== req.user.id) {
        const { ip_address, user_agent, ...rest } = row;
        return {
          ...rest,
          ip_address: null,
          user_agent: null,
        };
      }
      return row;
    });

    return {
      data,
      total,
      page,
      limit,
    };
  });
}

module.exports = routes;
