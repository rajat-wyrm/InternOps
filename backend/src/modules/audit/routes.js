const auth = require('../../middleware/auth');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const repo = require('./repository');
const { encodeCursor, decodeCursor } = require('../../utils/keysetCursor');

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().optional(),
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
        description: 'Get audit logs using keyset pagination',
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
        limit,
        cursor,
        userId,
        resourceType,
        action,
        search,
        startDate,
        endDate,
      } = parsed.data;

      let decodedCursor;

      if (cursor) {
        try {
          decodedCursor = decodeCursor(cursor);
        } catch (err) {
          return reply.status(err.statusCode || 400).send({
            error: err.message || 'Invalid cursor',
          });
        }

        if (
          typeof decodedCursor.id !== 'string' ||
          typeof decodedCursor.createdAt !== 'string' ||
          Number.isNaN(Date.parse(decodedCursor.createdAt))
        ) {
          return reply.status(400).send({
            error: 'Invalid cursor',
          });
        }
      }

      const { records, hasNextPage } = await repo.getAuditLogs({
        limit,
        isAdmin: req.user.role === 'ADMIN',
        userId: req.user.role === 'ADMIN' ? userId : req.user.id,
        resourceType,
        action,
        search,
        startDate,
        endDate,
        cursor: decodedCursor,
      });

      const data = records.map((row) => {
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

      const lastRow = records[records.length - 1];

      const nextCursor =
        hasNextPage && lastRow
          ? encodeCursor({
              id: lastRow.id,
              createdAt: lastRow.created_at,
            })
          : null;

      return {
        data,
        limit,
        nextCursor,
      };
    }
  );
}

module.exports = routes;
