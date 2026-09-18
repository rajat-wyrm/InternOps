const auth = require('../../middleware/auth');
const repo = require('./repository');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const rbac = require('../../middleware/rbac');

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
  startDate: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
      message: 'startDate must be a valid date',
    }),
  endDate: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
      message: 'endDate must be a valid date',
    }),
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

      const { logs, total } = await repo.getFilteredAuditLogs({
        conditions,
        params,
        limit,
        offset,
      });

      // Strip ip_address and user_agent for non-admins if the log is not their own
      const data = logs.map((row) => {
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
