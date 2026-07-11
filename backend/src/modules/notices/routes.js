const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');

async function noticesRoutes(fastify) {
  //
  fastify.get(
    '/notices',
    {
      schema: { tags: ['Notices'], description: 'Get all notices (admin)' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      try {
        const notices = await repo.getAllNotices();
        return reply.send(notices);
      } catch (err) {
        // If the notices table does not yet exist (migration pending on production)
        // return an empty list with 503 rather than crashing with 500.
        req.log.error({ err }, 'notices table unavailable in GET /notices');
        if (err.code === '42P01') {
          // NOTE: send a bare array here (not { error, notices: [] }) so the
          // response shape always matches the success path — the frontend
          // expects `data` to be an array it can call .map() on directly.
          return reply.status(503).send([]);
        }
        return reply.status(500).send({ error: 'Failed to fetch notices' });
      }
    }
  );

  // PUBLIC — no auth
  fastify.get(
    '/notices/public',
    {
      schema: { tags: ['Notices'], description: 'Get active notices (public)' },
    },
    async (_req, reply) => {
      try {
        const notices = await repo.getActiveNotices();
        return reply.send(notices);
      } catch (err) {
        // If the notices table does not yet exist (migration pending), return an
        // empty list rather than a 500 so the Login page still loads correctly.
        _req.log.warn(
          { err },
          'notices table unavailable – returning empty list'
        );
        return reply.send([]);
      }
    }
  );

  // PROTECTED — admin + senior_tl
  fastify.post(
    '/notices',
    {
      schema: {
        tags: ['Notices'],
        description: 'Create a notice',
        body: toSchema(
          z.object({
            title: z.string().trim().min(1, 'Title is required'),
            content: z.string().trim().min(1, 'Content is required'),
            category: z
              .enum(['GENERAL', 'REMINDER', 'ALERT', 'NEWS'])
              .optional(),
          })
        ),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const { title, content, category } = req.body;
      if (!title?.trim())
        return reply.status(400).send({ error: 'title is required' });
      if (!content?.trim())
        return reply.status(400).send({ error: 'content is required' });

      const notice = await repo.createNotice({
        title: title.trim(),
        content: content.trim(),
        category: category ?? 'GENERAL',
        createdBy: req.user.id,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'NOTICE_CREATED',
        resourceType: 'notice',
        resourceId: notice.id,
        details: { title: notice.title, category: notice.category },
        ...extractRequestInfo(req),
      };
      return reply.status(201).send(notice);
    }
  );

  fastify.patch(
    '/notices/:id',
    {
      schema: {
        tags: ['Notices'],
        description: 'Update a notice',
        params: toSchema(z.object({ id: z.string() })),
        body: toSchema(
          z.object({
            title: z.string().trim().min(1, 'Title cannot be empty').optional(),
            content: z
              .string()
              .trim()
              .min(1, 'Content cannot be empty')
              .optional(),
            category: z
              .enum(['GENERAL', 'REMINDER', 'ALERT', 'NEWS'])
              .optional(),
            is_active: z.boolean().optional(),
          })
        ),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const { id } = req.params;
      const { title, content, category, is_active } = req.body;

      if (title !== undefined && !title.trim()) {
        return reply.status(400).send({
          error: 'title cannot be empty',
        });
      }

      if (content !== undefined && !content.trim()) {
        return reply.status(400).send({
          error: 'content cannot be empty',
        });
      }
      const updated = await repo.updateNotice(id, {
        title,
        content,
        category,
        is_active,
      });
      if (!updated)
        return reply.status(404).send({ error: 'Notice not found' });
      const action =
        is_active === false ? 'NOTICE_DEACTIVATED' : 'NOTICE_UPDATED';
      req.auditOnResponse = {
        userId: req.user.id,
        action,
        resourceType: 'notice',
        resourceId: updated.id,
        details: { title: updated.title },
        ...extractRequestInfo(req),
      };
      return reply.send(updated);
    }
  );

  fastify.delete(
    '/notices/:id',
    {
      schema: {
        tags: ['Notices'],
        description: 'Soft-delete a notice',
        params: toSchema(z.object({ id: z.string() })),
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const { id } = req.params;
      const deleted = await repo.softDeleteNotice(id);
      if (!deleted)
        return reply.status(404).send({ error: 'Notice not found' });
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'NOTICE_DELETED',
        resourceType: 'notice',
        resourceId: deleted.id,
        ...extractRequestInfo(req),
      };
      return reply.status(204).send();
    }
  );
}

module.exports = noticesRoutes;
