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
    async (req) => {
      const departments = await repo.getAll();

      if (req.user.role === 'ADMIN') {
        return departments;
      }

      if (!req.user.departmentId) {
        return [];
      }

      return departments.filter(
        (department) => department.id === req.user.departmentId
      );
    }
  );

  fastify.get(
    '/:deptId/teams',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')],
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
      if (
        req.user.role !== 'ADMIN' &&
        req.user.departmentId !== req.params.deptId
      ) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
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

  // Replace the single Senior TL without moving existing assignments.
  fastify.post(
    '/:deptId/senior-tl-handover',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
      schema: {
        tags: ['Departments'],
        description: 'Atomically replace the single department Senior TL',
        params: {
          type: 'object',
          required: ['deptId'],
          properties: { deptId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['outgoing_lead_id', 'replacement_id', 'outgoing_role'],
          additionalProperties: false,
          properties: {
            outgoing_lead_id: { type: 'string', format: 'uuid' },
            replacement_id: { type: 'string', format: 'uuid' },
            outgoing_role: {
              type: 'string',
              enum: ['TL', 'CAPTAIN', 'INTERN'],
            },
            suspend_outgoing: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (req, reply) => {
      if (
        req.user.role === 'SENIOR_TL' &&
        req.user.departmentId !== req.params.deptId
      ) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const parsed = z
        .object({
          outgoing_lead_id: z.string().uuid(),
          replacement_id: z.string().uuid(),
          outgoing_role: z.enum(['TL', 'CAPTAIN', 'INTERN']),
          suspend_outgoing: z.boolean().optional().default(false),
        })
        .safeParse(req.body);
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: 'Invalid Senior TL handover request' });
      if (parsed.data.outgoing_lead_id === parsed.data.replacement_id) {
        return reply
          .status(400)
          .send({ error: 'Replacement must be a different user' });
      }
      try {
        return await service.handoverSeniorTl({
          departmentId: req.params.deptId,
          outgoingLeadId: parsed.data.outgoing_lead_id,
          replacementId: parsed.data.replacement_id,
          outgoingRole: parsed.data.outgoing_role,
          actorId: req.user.id,
          suspendOutgoing: parsed.data.suspend_outgoing,
        });
      } catch (error) {
        if (error.statusCode)
          return reply.status(error.statusCode).send({ error: error.message });
        throw error;
      }
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
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { confirmation: { type: 'string', maxLength: 255 } },
        },
      },
    },
    async (req, reply) => {
      const confirmation = req.body?.confirmation?.trim() || null;

      const result = await repo.deleteDepartment(
        req.params.id,

        confirmation
      );

      if (result.notFound) {
        return reply.status(404).send({ error: 'Department not found' });
      }
      if (result.confirmationRequired) {
        return reply.status(409).send({
          error: `Department cannot be deleted: ${result.userCount} users are still assigned to it`,
          code: 'DEPARTMENT_HAS_ASSIGNED_USERS',
          userCount: result.userCount,
          roleCounts: result.roleCounts,
        });
      }

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'DEPARTMENT_DELETED',
        resourceType: 'department',
        resourceId: req.params.id,
        details: {
          removalMode: 'anonymize',
          userCount: result.userCount,
        },
      };

      return {
        success: true,
        userCount: result.userCount,
        roleCounts: result.roleCounts,
      };
    }
  );
}

module.exports = routes;
