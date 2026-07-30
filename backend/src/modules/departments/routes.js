const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const service = require('./service');
const { z } = require('zod');

async function routes(fastify) {
  // Create a department (Admin only)
  fastify.post(
    '/',
    {
      preHandler: [auth, rbac('ADMIN'), sanitize],
      schema: {
        tags: ['Departments'],
        description: 'Create a new department',
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
    },
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
  fastify.get(
    '/',
    {
      preHandler: [auth],
      schema: { tags: ['Departments'], description: 'List all departments' },
    },
    async () => repo.getAll()
  );

  fastify.get(
    '/:deptId/teams',
    {
      preHandler: [auth, rbac('ADMIN')],
      schema: {
        tags: ['Departments'],
        description: 'List department teams by lead',
        params: {
          type: 'object',
          required: ['deptId'],
          properties: { deptId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req, reply) => {
      const parsed = z
        .object({ deptId: z.string().uuid() })
        .safeParse(req.params);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid department id',
          details: parsed.error.issues,
        });
      }

      return service.getDepartmentTeams(parsed.data.deptId);
    }
  );

  // Delete department
  fastify.delete(
    '/:id',
    {
      preHandler: [auth, rbac('ADMIN')],
      schema: {
        tags: ['Departments'],
        description: 'Delete a department',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        querystring: {
          type: 'object',
          properties: { force: { type: 'string', enum: ['true', 'false'] } },
        },
      },
    },
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
