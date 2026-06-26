const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');

async function noticesRoutes(fastify) {
  //
  fastify.get(
    '/api/notices',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
    async (req, reply) => {
      // You will need a new repository function that fetches all notices, including inactive ones, for admin view
      const notices = await repo.getAllNotices();
      return reply.send(notices);
    }
  );

  // PUBLIC — no auth
  fastify.get('/api/notices/public', async (_req, reply) => {
    const notices = await repo.getActiveNotices();
    return reply.send(notices);
  });

  // PROTECTED — admin + senior_tl
  fastify.post(
    '/api/notices',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
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
    '/api/notices/:id',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
    async (req, reply) => {
      const { id } = req.params;
      const { title, content, category, is_active } = req.body;

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
    '/api/notices/:id',
    { preHandler: [auth, rbac('ADMIN')] },
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
