const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const service = require('./service');
const pool = require('../../config/db');

async function assertAccess(req, reply, internId) {
  const user = req.user;
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // Admin and Senior TL have full access
  if (user.role === 'ADMIN' || user.role === 'SENIOR_TL') {
    return true;
  }

  // Intern can access their own record
  if (user.id === internId) {
    return true;
  }

  // TL or Captain can access subordinates
  if (user.role === 'TL' || user.role === 'CAPTAIN') {
    const subRes = await pool.query(
      `WITH RECURSIVE subordinates AS (
         SELECT id FROM users WHERE manager_id = $1 AND deleted_at IS NULL
         UNION ALL
         SELECT u.id FROM users u
         JOIN subordinates s ON u.manager_id = s.id
         WHERE u.deleted_at IS NULL
       )
       SELECT id FROM subordinates WHERE id = $2`,
      [user.id, internId]
    );

    if (subRes.rows.length > 0) {
      return true;
    }
  }

  reply.status(403).send({
    error:
      'Access denied: You do not have permission to view or generate reviews for this intern.',
  });
  return false;
}

async function routes(fastify) {
  // Generate AI Performance Review
  fastify.post(
    '/:internId/generate',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')],
    },
    async (req, reply) => {
      const { internId } = req.params;
      const allowed = await assertAccess(req, reply, internId);
      if (!allowed) return;

      const { periodStart, periodEnd } = req.body || {};

      try {
        const review = await service.generateReview(
          internId,
          req.user.id,
          periodStart,
          periodEnd
        );
        return review;
      } catch (err) {
        req.log.error(err, 'Failed to generate AI performance review');
        return reply.status(err.statusCode || 500).send({
          error: err.message || 'Failed to generate AI performance review',
        });
      }
    }
  );

  // Get Latest AI Performance Review
  fastify.get(
    '/:internId',
    {
      preHandler: [auth],
    },
    async (req, reply) => {
      const { internId } = req.params;
      const allowed = await assertAccess(req, reply, internId);
      if (!allowed) return;

      const review = await service.getLatestReview(internId);
      if (!review) {
        return reply
          .status(404)
          .send({ error: 'No performance review found for this intern' });
      }
      return review;
    }
  );

  // Get Review History
  fastify.get(
    '/:internId/history',
    {
      preHandler: [auth],
    },
    async (req, reply) => {
      const { internId } = req.params;
      const allowed = await assertAccess(req, reply, internId);
      if (!allowed) return;

      const history = await service.getReviewHistory(internId);
      return { history };
    }
  );

  // Get Trends
  fastify.get(
    '/:internId/trends',
    {
      preHandler: [auth],
    },
    async (req, reply) => {
      const { internId } = req.params;
      const allowed = await assertAccess(req, reply, internId);
      if (!allowed) return;

      const history = await service.getReviewHistory(internId);
      const latest = history[0] || null;
      const previous = history[1] || null;

      const trendData = {
        current_score: latest?.overall_score || 0,
        previous_score: previous?.overall_score || null,
        change: previous
          ? Math.round((latest?.overall_score || 0) - previous.overall_score)
          : 0,
        direction: latest?.performance_trend?.direction || 'stable',
        history: history.map((h) => ({
          id: h.id,
          date: h.created_at,
          score: h.overall_score,
          level: h.performance_level,
        })),
      };

      return trendData;
    }
  );

  // Get Active Recommendations
  fastify.get(
    '/:internId/recommendations',
    {
      preHandler: [auth],
    },
    async (req, reply) => {
      const { internId } = req.params;
      const allowed = await assertAccess(req, reply, internId);
      if (!allowed) return;

      const latest = await service.getLatestReview(internId);
      return {
        recommendations: latest?.recommendations || [],
        learning_plan: latest?.learning_plan || [],
      };
    }
  );

  // Get Evidence breakdown
  fastify.get(
    '/:internId/evidence',
    {
      preHandler: [auth],
    },
    async (req, reply) => {
      const { internId } = req.params;
      const allowed = await assertAccess(req, reply, internId);
      if (!allowed) return;

      const latest = await service.getLatestReview(internId);
      return {
        evidence: latest?.evidence || [],
        score_breakdown: latest?.score_breakdown || {},
        deterministic_metrics: latest?.deterministic_metrics || {},
      };
    }
  );
}

module.exports = routes;
