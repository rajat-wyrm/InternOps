const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const uptoskillsService = require('./service');

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
      try {
        const status = await uptoskillsService.getSyncStatus();

        return reply.send(status);
      } catch (error) {
        return reply.code(500).send({
          error: 'Failed to get UptoSkills sync status',
          message: error.message,
        });
      }
    }
  );
}

module.exports = routes;
