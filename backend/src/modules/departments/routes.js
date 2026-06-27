const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const { csrfMiddleware } = require('../../middleware/csrf');
const repo = require('./repository');

async function routes(fastify) {
  // Create a department (Admin only)
  fastify.post(
    '/',
    { preHandler: [auth, rbac('ADMIN'), csrfMiddleware] },
    async (req, reply) => {
      const name = (req.body?.name || '').trim();

      if (!name) {
        return reply.status(400).send({ error: 'Name required' });
      }

      const dept = await repo.createDepartment(name, req.user.id);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'DEPARTMENT_CREATED',
        resourceType: 'department',
        resourceId: dept.id,
      };
      return dept;
    }
  );

  // List departments
  fastify.get('/', { preHandler: [auth] }, async () => repo.getAll());

  // Delete department
  fastify.delete(
    '/:id',
    { preHandler: [auth, rbac('ADMIN'), csrfMiddleware] },
    async (req, reply) => {
      const force = req.query?.force === 'true';

      const result = await repo.deleteDepartment(req.params.id, force);

      if (!result.success) {
        return reply.status(409).send({
          error: `Department has ${result.userCount} assigned users. Reassign them first or use ?force=true.`,
          userCount: result.userCount,
        });
      }

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'DEPARTMENT_DELETED',
        resourceType: 'department',
        resourceId: req.params.id,
        details: {
          force,
        },
      };

      return {
        success: true,
        force,
      };
    }
  );
}

module.exports = routes;
