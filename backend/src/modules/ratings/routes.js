'use strict';
const auth = require('../../middleware/auth');
const direct = require('../../middleware/directManager');
const ownership = require('../../middleware/ownership');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { send: sendNotification } = require('../notifications/repository');
const { z } = require('zod');

module.exports = async function ratingsRoutes(fastify) {
  // Submit a rating for a direct report (immutable history row).
  fastify.post('/', { schema: { tags: ['Ratings'], description: 'Submit a rating' }, preHandler: [auth, direct('rated_user_id')] }, async (req) => {
    const { rated_user_id, score, remarks } = z.object({
      rated_user_id: z.string().uuid(),
      score: z.coerce.number().int().min(1).max(5),
      remarks: z.string().max(2000).optional(),
    }).parse(req.body);

    const rating = await repo.addRating(rated_user_id, req.user.id, score, remarks || null);
    await createAuditLog({
      userId: req.user.id,
      ...extractRequestInfo(req),
      action: 'RATING_GIVEN',
      resourceType: 'rating',
      resourceId: rating.id,
      details: { target: rated_user_id, score },
    });
    await sendNotification(rated_user_id, `You received a new rating: ${score}/5.`);
    return rating;
  });

  // View a user's rating history (must be self or within hierarchy).
  fastify.get('/:userId', { schema: { tags: ['Ratings'], description: 'Get rating history' }, preHandler: [auth, ownership('userId')] }, async (req) => {
    return repo.getRatings(req.params.userId);
  });
};
