const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');

async function routes(fastify) {
  fastify.get(
    '/sync-status',
    {
      preHandler: [auth, rbac('ADMIN')],
      schema: {
        tags: ['Uptoskills'],
        description: 'Get uptoskills sync status',
      },
    },
    async (request, reply) => {
      return reply.code(501).send({
        error: 'Not Implemented',
        message: 'UptoSkills integration is not available yet.',
      });
    }
  );
}

module.exports = routes;
