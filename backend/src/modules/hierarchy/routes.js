const auth = require('../../middleware/auth');
const repo = require('./repository');
const { z } = require('zod');

const teamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

async function routes(fastify) {
  fastify.get('/my/direct-reports', { preHandler: [auth] }, async (req) =>
    repo.getDirectReports(req.user.id)
  );

  fastify.get('/my/team', { preHandler: [auth] }, async (req, reply) => {
    const parsed = teamQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.issues,
      });
    }
    const { page, limit } = parsed.data;
    const result = await repo.getFullTeam(req.user.id, { page, limit });
    return {
      data: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  });

  fastify.get('/my/chain', { preHandler: [auth] }, async (req) =>
    repo.getUpwardChain(req.user.id)
  );
}
module.exports = routes;
