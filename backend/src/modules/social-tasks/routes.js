'use strict';
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');
const emailService = require('../../services/email');

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  targetPlatform: z.string().max(100).optional(),
  taskLink: z.string().max(500).optional(),
  deadline: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional()
    .refine(
      (v) => !v || !Number.isNaN(Date.parse(v)),
      'deadline must be a valid ISO date'
    ),
});

const assignTaskSchema = z.object({
  userIds: z.array(z.string().uuid()),
});

module.exports = async function socialTasksRoutes(fastify) {
  // Create a social task (Admin / Senior TL).
  fastify.post(
    '/',
    {
      schema: { tags: ['Tasks'], description: 'Create a social task' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      const parsed = createTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }
      const data = parsed.data;

      const task = await repo.createTask({ ...data, createdBy: req.user.id });
      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'TASK_CREATED',
        resourceType: 'social_task',
        resourceId: task.id,
        details: { title: task.title },
      };
      try {
        const creatorEmail = await repo.getUserEmail(req.user.id);
        if (creatorEmail) {
          await emailService.sendNotification(creatorEmail, {
            title: 'Task Created',
            message: `Task "${task.title}" has been created successfully.`,
            recipient: req.user.id,
          });
        }
      } catch (emailErr) {
        req.log.warn(
          { emailErr },
          'Task created but notification email failed'
        );
      }
      return task;
    }
  );

  fastify.post(
    '/:id/assign',
    {
      schema: { tags: ['Tasks'], description: 'Assign task to interns' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      const parsed = assignTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }
      const { userIds } = parsed.data;
      if (userIds.length > 0) {
        await repo.assignTask(req.params.id, userIds, req.user.id);
      }

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'TASK_ASSIGNED',
        resourceType: 'social_task',
        resourceId: req.params.id,
        details: { userIds },
      };

      return { success: true };
    }
  );

  // List social tasks (any authenticated user). Optional ?deadlineBefore=ISO date.
  fastify.get(
    '/',
    {
      schema: { tags: ['Tasks'], description: 'List social tasks' },
      preHandler: [auth],
    },
    async (req) => {
      return repo.getTasks(req.query || {});
    }
  );
  // // Update a social task
  fastify.put(
    '/:id',
    {
      schema: { tags: ['Tasks'], description: 'Update social task' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      try {
        const data = z
          .object({
            title: z.string().min(1).max(255),
            description: z.string().max(2000).optional(),
            targetPlatform: z.string().max(100).optional(),
            taskLink: z.string().max(500).optional(),
            deadline: z.string().optional(),
          })
          .parse(req.body);

        const updatedTask = await repo.updateTask(req.params.id, data);

        if (!updatedTask) {
          return reply
            .code(404)
            .send({ success: false, message: 'Task not found' });
        }

        // Create an audit trail log for the edit action
        await createAuditLog({
          userId: req.user.id,
          ...extractRequestInfo(req),
          action: 'TASK_UPDATED',
          resourceType: 'social_task',
          resourceId: req.params.id,
          details: { title: updatedTask.title },
        });

        return updatedTask;
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.name === 'ZodError' ? 400 : 500).send(error);
      }
    }
  );

  // // Delete a social task
  fastify.delete(
    '/:id',
    {
      schema: { tags: ['Tasks'], description: 'Delete social task' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      try {
        const deletedTask = await repo.deleteTask(req.params.id);

        if (!deletedTask) {
          return reply
            .code(404)
            .send({ success: false, message: 'Task not found' });
        }

        // Create an audit trail log for the delete action
        await createAuditLog({
          userId: req.user.id,
          ...extractRequestInfo(req),
          action: 'TASK_DELETED',
          resourceType: 'social_task',
          resourceId: req.params.id,
          details: { title: deletedTask.title },
        });

        return { success: true };
      } catch (error) {
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ success: false, error: 'Internal Server Error' });
      }
    }
  );
  fastify.get(
    '/',
    {
      schema: { tags: ['Tasks'], description: 'List social tasks' },
      preHandler: [auth],
    },
    async (req) => {
      return repo.getTasks(req.query || {}, req.user.id, req.user.role);
    }
  );
};
