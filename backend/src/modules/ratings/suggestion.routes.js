const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const { checkHierarchyAccess } = require('../../utils/hierarchy');

const service = require('./suggestion.service');

module.exports = async function (fastify) {
  fastify.get(
    '/suggestions/:userId',
    {
      schema: {
        tags: ['Ratings'],
        description: 'Get rating suggestion data',
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')],
    },
    async (req, reply) => {
      const { userId } = req.params;

      if (req.user.role !== 'ADMIN') {
        const allowed = await checkHierarchyAccess(req.user.id, userId);

        if (!allowed) {
          return reply.status(403).send({
            error: 'User not in your hierarchy',
          });
        }
      }

      return service.getSuggestionData(userId);
    }
  );
};
