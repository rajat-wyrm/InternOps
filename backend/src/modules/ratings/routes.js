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
const overallService = require('./overall.service');
const {
  isCurrentFourWeekPeriod,
  validateFourWeekPeriod,
} = require('./ratingPeriods');

module.exports = async function ratingsRoutes(fastify) {
  await fastify.register(suggestionRoutes);

  // Submit a rating for someone in your team (immutable history row).
  fastify.post(
    '/',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { tags: ['Ratings'], description: 'Submit a rating' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'), sanitize],
    },
    async (req, reply) => {
      const {
        rated_user_id,
        score,
        remarks,
        rating_period_start,
        rating_period_end,
      } = z
        .object({
          rated_user_id: z.string().uuid(),
          score: z.coerce.number().multipleOf(0.1).min(1).max(10),
          remarks: z.string().max(2000).optional(),
          rating_period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          rating_period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(req.body);
      if (!validateFourWeekPeriod(rating_period_start, rating_period_end)) {
        return reply
          .status(400)
          .send({ error: 'Select a valid four-week rating period' });
      }

      if (!isCurrentFourWeekPeriod(rating_period_start, rating_period_end)) {
        return reply.status(400).send({
          error: 'Ratings can only be submitted for the current week',
        });
      }
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
        remarks || null,
        rating_period_start,
        rating_period_end
      );

      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'RATING_GIVEN',
        resourceType: 'rating',
        resourceId: rating.id,
        details: {
          target: rated_user_id,
          score,
          rating_period_start,
          rating_period_end,
        },
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

  // View a department ratings sheet (Admin / authorized hierarchy)
  fastify.get(
    '/department/:deptId/sheet',
    {
      schema: {
        tags: ['Ratings'],
        description: 'Get a department ratings sheet',
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')],
    },
    async (req, reply) => {
      const paramsSchema = z.object({ deptId: z.string().uuid() });
      const querySchema = z
        .object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .refine((value) => value.from <= value.to, {
          message: 'from must be on or before to',
        })
        .refine(
          (value) => {
            const from = new Date(`${value.from}T00:00:00Z`);
            const to = new Date(`${value.to}T00:00:00Z`);
            return (to - from) / 86400000 <= 366;
          },
          { message: 'Date range cannot exceed 366 days' }
        );

      const parsedParams = paramsSchema.safeParse(req.params);
      const parsedQuery = querySchema.safeParse(req.query);
      if (!parsedParams.success || !parsedQuery.success) {
        return reply.status(400).send({
          error: 'Invalid ratings sheet request',
          details: [
            ...(parsedParams.success ? [] : parsedParams.error.issues),
            ...(parsedQuery.success ? [] : parsedQuery.error.issues),
          ],
        });
      }

      return repo.getDepartmentRatingsSheet({
        departmentId: parsedParams.data.deptId,
        requesterId: req.user.id,
        isAdmin: req.user.role === 'ADMIN',
        requesterRole: req.user.role,
        from: parsedQuery.data.from,
        to: parsedQuery.data.to,
      });
    }
  );

  // View a user's rating history (must be self or within hierarchy).
  fastify.get(
    '/:userId',
    {
      schema: {
        tags: ['Ratings'],
        description: 'Get rating history',
      },
      preHandler: [auth, ownership('userId')],
    },
    async (req) => {
      const { userId } = z
        .object({ userId: z.string().uuid() })
        .parse(req.params);
      return repo.getRatings(userId);
    }
  );

  // View overall performance summary
  fastify.get(
    '/:userId/overall-summary',
    {
      schema: {
        tags: ['Ratings'],
        description: 'Get overall performance summary',
      },
      preHandler: [auth, ownership('userId')],
    },
    async (req, reply) => {
      const { userId } = z
        .object({
          userId: z.string().uuid(),
        })
        .parse(req.params);
      try {
        return await overallService.generateOverallSummary(userId);
      } catch (error) {
        return reply.status(500).send({
          error: 'Failed to generate overall summary',
        });
      }
    }
  );

  // View ratings for all users in a department (Admin / Manager)
  fastify.get(
    '/department/:deptId',
    {
      schema: {
        tags: ['Ratings'],
        description: 'Get ratings for a department',
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')],
    },
    async (req) => {
      const { deptId } = z
        .object({ deptId: z.string().uuid() })
        .parse(req.params);
      return repo.getRatingsByDepartment(deptId);
    }
  );
};
