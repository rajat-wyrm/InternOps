const auth = require('../../middleware/auth');
const repo = require('./repository');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');

async function routes(fastify) {
  // Get notifications with pagination
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Notifications'],
        description: 'Get notifications with pagination',
        querystring: toSchema(
          z.object({
            page: z.string().optional(),
            limit: z.string().optional(),
          })
        ),
      },
      preHandler: [auth],
    },
    async (req) => {
      const schema = z.object({
        page: z
          .string()
          .optional()
          .transform((v) => parseInt(v || '1')),
        limit: z
          .string()
          .optional()
          .transform((v) => parseInt(v || '20'))
          .pipe(z.number().int().min(1).max(100, 'limit cannot exceed 100')),
      });
      const query = schema.parse(req.query);
      return repo.get(req.user.id, query);
    }
  );
  // Mark all as read
  fastify.post(
    '/read-all',
    {
      schema: {
        tags: ['Notifications'],
        description: 'Mark all notifications as read',
      },
      preHandler: [auth],
    },
    async (req) => {
      await repo.markAllRead(req.user.id);
      return { success: true };
    }
  );
  // Delete all notifications
  fastify.delete(
    '/all',
    {
      schema: {
        tags: ['Notifications'],
        description: 'Delete all notifications',
      },
      preHandler: [auth],
    },
    async (req) => {
      await repo.deleteAllNotifications(req.user.id);
      return { success: true };
    }
  );
  // Mark single as read
  fastify.patch(
    '/:id/read',
    {
      schema: {
        tags: ['Notifications'],
        description: 'Mark a notification as read',
        params: toSchema(z.object({ id: z.string() })),
      },
      preHandler: [auth],
    },
    async (req) => {
      await repo.markRead(req.params.id, req.user.id);
      return { success: true };
    }
  );

  // Delete a notification
  fastify.delete(
    '/:id',
    {
      schema: {
        tags: ['Notifications'],
        description: 'Delete a notification',
        params: toSchema(z.object({ id: z.string() })),
      },
      preHandler: [auth],
    },
    async (req, reply) => {
      try {
        await repo.deleteNotification(req.params.id, req.user.id);
      } catch (err) {
        if (err.message && err.message.startsWith('Notification not found')) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
      return { success: true };
    }
  );

  // Unread count (useful for badges)
  fastify.get(
    '/unread-count',
    {
      schema: {
        tags: ['Notifications'],
        description: 'Get unread notification count',
      },
      preHandler: [auth],
    },
    async (req) => {
      const count = await repo.getUnreadCount(req.user.id);
      return { unread: count };
    }
  );
}

module.exports = routes;
