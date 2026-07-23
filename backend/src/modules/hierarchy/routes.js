const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const service = require('./service');
const { z } = require('zod');

const teamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const fullTeamQuerySchema = z.object({
  managerId: z.string().uuid(),
});

async function routes(fastify) {
  fastify.get(
    '/full-team',
    {
      preHandler: [auth, rbac('ADMIN')],
      schema: {
        tags: ['Hierarchy'],
        description: 'Get full team for a specific manager',
        querystring: {
          type: 'object',
          required: ['managerId'],
          properties: { managerId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req, reply) => {
      const parsed = fullTeamQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: parsed.error.issues,
        });
      }

      const result = await service.getFullTeam(parsed.data.managerId);
      return {
        data: result.rows,
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    }
  );

  fastify.get(
    '/my/direct-reports',
    {
      preHandler: [auth],
      schema: { tags: ['Hierarchy'], description: 'Get direct reports' },
    },
    async (req) => repo.getDirectReports(req.user.id)
  );

  fastify.get(
    '/my/team',
    {
      preHandler: [auth],
      schema: {
        tags: ['Hierarchy'],
        description: 'Get full team (paginated)',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
    },
    async (req, reply) => {
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
    }
  );

  fastify.get(
    '/my/chain',
    {
      preHandler: [auth],
      schema: {
        tags: ['Hierarchy'],
        description: 'Get management chain upward',
      },
    },
    async (req) => repo.getUpwardChain(req.user.id)
  );
}
module.exports = routes;
