const { toSchema } = require('../../utils/schemaHelper');
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
    async () => ({ status: 'not_implemented' })
  );
}
module.exports = routes;
