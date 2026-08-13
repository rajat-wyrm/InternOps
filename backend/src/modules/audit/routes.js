const auth = require('../../middleware/auth');
const pool = require('../../config/db');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');

// Whitelist of allowed filter keys → qualified column names.
// Prevents SQL injection if filter keys ever become user-controllable.
const AUDIT_COLUMN_MAP = {
  userId: 'al.user_id',
  resourceType: 'al.resource_type',
  action: 'al.action',
};

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  resourceType: z.string().trim().max(100).optional(),
  action: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
  startDate: z.string().trim().max(40).optional(),
  endDate: z.string().trim().max(40).optional(),
});

async function routes(fastify) {
  fastify.get(
    '/',
    {
      preHandler: [auth],
      schema: {
        tags: ['Audit'],
        description: 'Get audit logs',
        querystring: toSchema(auditQuerySchema),
      },
    },
    async (req, reply) => {
      const parsed = auditQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: parsed.error.issues,
        });
      }

      const {
        page,
        limit,
        userId,
        resourceType,
        action,
        search,
        startDate,
        endDate,
      } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [];
      const params = [];

      if (req.user.role === 'ADMIN') {
        if (userId) {
          params.push(userId);
          conditions.push(`${AUDIT_COLUMN_MAP.userId} = $${params.length}`);
        }
      } else {
        params.push(req.user.id);
        conditions.push(`${AUDIT_COLUMN_MAP.userId} = $${params.length}`);
      }

      if (resourceType) {
        params.push(resourceType);
        conditions.push(`${AUDIT_COLUMN_MAP.resourceType} = $${params.length}`);
      }

      if (action) {
        params.push(`%${action}%`);
        conditions.push(`${AUDIT_COLUMN_MAP.action} ILIKE $${params.length}`);
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

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // Fetch total matching records for pagination
      const countJoin = search ? 'LEFT JOIN users u ON al.user_id = u.id' : '';
      const totalResult = await pool.query(
        `SELECT COUNT(*) FROM audit_logs al ${countJoin} ${whereClause}`,
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
    }
  );
}

module.exports = routes;
