const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');

async function routes(fastify) {
  fastify.get(
    '/sync-status',
    {
      preHandler: [auth, rbac(['ADMIN'])],
      schema: {
        tags: ['Uptoskills'],
        description: 'Get uptoskills sync status',
        hide: true,
      },
    },
    async (request, reply) => {
      return reply.code(501).send({
        error: 'Not Implemented',
        message: 'UptoSkills synchronization integration is not implemented.',
      });
    }
  );
}

module.exports = routes;
