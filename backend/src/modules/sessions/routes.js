const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');

async function routes(fastify) {
  // List own sessions
  fastify.get(
    '/me',
    {
      schema: { tags: ['Sessions'], description: 'List own sessions' },
      preHandler: [auth],
    },
    async (req) => {
      return repo.getUserSessions(req.user.id);
    }
  );

  // Revoke a specific session (atomic ownership check + revoke)
  fastify.delete(
    '/me/:sessionId',
    {
      schema: {
        tags: ['Sessions'],
        description: 'Revoke a specific session',
        params: toSchema(z.object({ sessionId: z.string() })),
      },
      preHandler: [auth],
    },
    async (req, reply) => {
      const success = await repo.revokeSession(
        req.params.sessionId,
        req.user.id
      );
      if (!success)
        return reply.status(404).send({ error: 'Session not found' });
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'SESSION_REVOKED',
        resourceType: 'session',
        resourceId: req.params.sessionId,
        ...extractRequestInfo(req),
      };
      return { message: 'Session revoked' };
    }
  );

  // Revoke all other sessions
  fastify.post(
    '/me/revoke-all',
    {
      schema: { tags: ['Sessions'], description: 'Revoke all other sessions' },
      preHandler: [auth, sanitize],
    },
    async (req, reply) => {
      await repo.revokeAllUserSessions(req.user.id);
      const { rotateAndSetCsrf } = require('../../middleware/csrf');
      rotateAndSetCsrf(req, reply, null);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'ALL_SESSIONS_REVOKED',
        resourceType: 'session',
        ...extractRequestInfo(req),
      };
      return { message: 'All sessions revoked. Please re-login.' };
    }
  );

  // Admin: revoke all sessions of a specific user
  fastify.post(
    '/admin/revoke-user/:userId',
    {
      schema: {
        tags: ['Sessions'],
        description: 'Admin: revoke all sessions of a user',
        params: toSchema(z.object({ userId: z.string() })),
      },
      preHandler: [auth, rbac('ADMIN'), sanitize],
    },
    async (req, reply) => {
      const { userId } = req.params;
      await repo.revokeAllUserSessions(userId);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'ADMIN_REVOKED_USER_SESSIONS',
        resourceType: 'session',
        resourceId: userId,
        ...extractRequestInfo(req),
      };
      return { message: `All sessions for user ${userId} revoked` };
    }
  );
}

module.exports = routes;
