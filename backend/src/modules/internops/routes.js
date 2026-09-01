const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const service = require('./service');

const summaryQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: '"startDate" must be on or before "endDate"',
    path: ['endDate'],
  });

async function routes(fastify) {
  fastify.get(
    '/summary',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
      schema: {
        tags: ['InternOps'],
        description: 'Get aggregated intern overview data',
        querystring: toSchema(summaryQuerySchema),
      },
    },
    async (req, reply) => {
      const parsed = summaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: parsed.error.issues,
        });
      }

      const { startDate, endDate } = parsed.data;
      return service.getSummary(startDate, endDate);
    }
  );
}

module.exports = routes;
