const auth = require('../../middleware/auth');
const direct = require('../../middleware/directManager');
const ownership = require('../../middleware/ownership');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { send: sendNotification } = require('../notifications/repository');
const { z } = require('zod');

async function routes(fastify) {
  // Submit rating (requires auth, and must be direct manager with valid hierarchy step)
  fastify.post('/', { preHandler: [auth, direct('rated_user_id')] }, async (req) => {
    const schema = z.object({
      rated_user_id: z.string().uuid(),
      score: z.number().min(1).max(5),
      remarks: z.string().optional()
    });
    const { rated_user_id, score, remarks } = schema.parse(req.body);
    const rating = await repo.addRating(rated_user_id, req.user.id, score, remarks);
    
    await createAuditLog({
      userId: req.user.id,
      action: 'RATING_SUBMITTED',
      resourceType: 'rating',
      resourceId: rating.id,
      details: { rated_user_id, score, remarks },
      ...extractRequestInfo(req)
    });

    await sendNotification(rated_user_id, `You received a performance rating of ${score}/5 from your manager.`);
    return rating;
  });

  // Get ratings for a user (requires ownership check)
  fastify.get('/:userId', { preHandler: [auth, ownership('userId')] }, async (req) => {
    return repo.getRatings(req.params.userId);
  });
}

module.exports = routes;
