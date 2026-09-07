const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const service = require('./service');
const { z } = require('zod');
const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  departmentId: z.string().uuid().optional(),
  status: z
    .enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'TERMINATED', 'DISCONTINUED'])
    .optional(),
  issue: z
    .enum([
      'missing-document',
      'missing-phone',
      'missing-department',
      'overdue',
    ])
    .optional(),
});
async function routes(fastify) {
  fastify.get(
    '/dashboard',
    {
      preHandler: [auth, rbac('ADMIN', 'HR')],
      schema: {
        tags: ['HR'],
        description: 'Get organization-wide HR dashboard',
      },
    },
    async (req, reply) => {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: 'Invalid HR filters', details: parsed.error.issues });
      return service.getDashboard(parsed.data);
    }
  );
}
module.exports = routes;
