const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const { notifyUser } = require('../../websocket');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const ownership = require('../../middleware/ownership');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const { send: sendNotification } = require('../notifications/repository');
const { z } = require('zod');
const suggestionRoutes = require('./suggestion.routes');

module.exports = async function ratingsRoutes(fastify) {
  await fastify.register(suggestionRoutes);
  // Submit a rating for someone in your team (immutable history row).
  fastify.post(
    '/',
    {
      schema: { tags: ['Ratings'], description: 'Submit a rating' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'), sanitize],
    },
    async (req, reply) => {
      const { rated_user_id, score, remarks } = z
        .object({
          rated_user_id: z.string().uuid(),
          score: z.coerce.number().int().min(1).max(10),
          remarks: z.string().max(2000).optional(),
        })
        .parse(req.body);

      if (req.user.id === rated_user_id) {
        return reply.status(400).send({ error: 'You cannot rate yourself' });
      }

      // Must be in the rater's downward hierarchy (admin can rate anyone).
      if (req.user.role !== 'ADMIN') {
        const ok = await checkHierarchyAccess(req.user.id, rated_user_id);
        if (!ok)
          return reply
            .status(403)
            .send({ error: 'This member is not in your team' });
      }

      const rating = await repo.addRating(
        rated_user_id,
        req.user.id,
        score,
        remarks || null
      );
      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'RATING_GIVEN',
        resourceType: 'rating',
        resourceId: rating.id,
        details: { target: rated_user_id, score },
      };
      await sendNotification(
        rated_user_id,
        `You received a new rating: ${score}/10.`
      ).catch(() => {});
      await notifyUser(rating.rated_user_id, 'rating-received', {
        rating,
      }).catch(() => {});

      return reply.status(201).send(rating);
    }
  );
  // View a user's rating history (must be self or within hierarchy).
  fastify.get(
    '/:userId',
    {
      schema: { tags: ['Ratings'], description: 'Get rating history' },
      preHandler: [auth, ownership('userId')],
    },
    async (req) => {
      return repo.getRatings(req.params.userId);
    }
  );
};
