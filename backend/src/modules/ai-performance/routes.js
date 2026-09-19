const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const service = require('./service');
const repo = require('./repository');
const { MAX_HIERARCHY_DEPTH } = require('../../utils/hierarchy');

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
    const hasAccess = await repo.hasSubordinateAccess(
      user.id,
      internId,
      MAX_HIERARCHY_DEPTH
    );

    if (hasAccess) {
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

  // =========================================================================
  // NEW: RISK PREDICTION ENDPOINTS
  // =========================================================================

  const riskRepo = require('./risk.repository');
  const riskService = require('./risk.service');
  const alertRepo = require('./alert.repository');
  const alertService = require('./alert.service');
  const auditRepo = require('../audit/repository');
  const { z } = require('zod');

  // -------------------------------------------------------------------------
  // GET /api/v1/ai/performance/risk/dashboard
  // Risk overview dashboard for all interns visible to the requesting user
  // Roles: ADMIN, SENIOR_TL, TL, CAPTAIN
  // -------------------------------------------------------------------------
  fastify.get(
    '/risk/dashboard',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')] },
    async (req, reply) => {
      try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
        const { riskLevel, departmentId } = req.query;

        const [distribution, tableData, alertSummary] = await Promise.all([
          riskRepo.getRiskDistribution(req.user.id, req.user.role),
          riskRepo.getDashboardRiskScores({
            requestingUserId: req.user.id,
            requestingUserRole: req.user.role,
            departmentId,
            riskLevel,
            page,
            limit,
          }),
          alertRepo.getActiveAlertSummary(req.user.id, req.user.role),
        ]);

        return {
          distribution,
          alert_summary: alertSummary,
          interns: tableData,
        };
      } catch (err) {
        req.log.error(err, 'Failed to load risk dashboard');
        return reply
          .status(500)
          .send({ error: 'Failed to load risk dashboard' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/ai/performance/:internId/risk
  // Current risk profile for a single intern
  // -------------------------------------------------------------------------
  fastify.get('/:internId/risk', { preHandler: [auth] }, async (req, reply) => {
    const { internId } = req.params;
    const allowed = await assertAccess(req, reply, internId);
    if (!allowed) return;

    try {
      const riskScore = await riskRepo.getLatestRiskScore(internId);
      if (!riskScore) {
        return reply.status(404).send({
          error:
            'No risk prediction available. Use POST /:internId/risk/compute to generate one.',
        });
      }

      // Also fetch active alerts for this intern
      const { data: alerts } = await alertRepo.listAlerts({
        internId,
        status: ['ACTIVE', 'ACKNOWLEDGED'],
        requestingUserId: req.user.id,
        requestingUserRole: req.user.role,
        limit: 10,
      });

      return { ...riskScore, active_alerts: alerts };
    } catch (err) {
      req.log.error(err, 'Failed to get risk profile');
      return reply
        .status(500)
        .send({ error: 'Failed to retrieve risk profile' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/ai/performance/:internId/risk/compute
  // Trigger risk recomputation for one intern (manual or system refresh)
  // Roles: ADMIN, SENIOR_TL, TL, CAPTAIN only
  // -------------------------------------------------------------------------
  fastify.post(
    '/:internId/risk/compute',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')] },
    async (req, reply) => {
      const { internId } = req.params;
      const allowed = await assertAccess(req, reply, internId);
      if (!allowed) return;

      const periodDays = Math.min(
        parseInt(req.body?.periodDays || '30', 10),
        90
      );

      try {
        const riskResult = await riskService.computeAndSaveRisk(
          internId,
          periodDays
        );

        // Process alerts (fire and forget — don't block response)
        setImmediate(async () => {
          try {
            await alertService.processRiskAlerts(
              riskResult,
              riskResult.raw_features || {},
              riskResult.feature_snapshot || {}
            );
          } catch (err) {
            req.log.warn({ err }, 'Alert processing failed after risk compute');
          }
        });

        // Audit log
        await auditRepo.logEvent({
          userId: req.user.id,
          action: 'PERF_RISK_COMPUTED',
          resourceType: 'performance_risk_score',
          resourceId: riskResult.id,
          details: {
            intern_id: internId,
            risk_score: riskResult.risk_score,
            risk_level: riskResult.risk_level,
            triggered_by: req.user.id,
          },
        });

        return riskResult;
      } catch (err) {
        req.log.error(err, 'Failed to compute risk score');
        return reply
          .status(err.statusCode || 500)
          .send({ error: err.message || 'Failed to compute risk score' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/ai/performance/:internId/risk/history
  // Historical risk snapshots for an intern
  // -------------------------------------------------------------------------
  fastify.get(
    '/:internId/risk/history',
    { preHandler: [auth] },
    async (req, reply) => {
      const { internId } = req.params;
      const allowed = await assertAccess(req, reply, internId);
      if (!allowed) return;

      const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);

      try {
        const history = await riskRepo.getRiskHistory(internId, limit);
        return { history };
      } catch (err) {
        req.log.error(err, 'Failed to get risk history');
        return reply
          .status(500)
          .send({ error: 'Failed to retrieve risk history' });
      }
    }
  );

  // =========================================================================
  // NEW: ALERT MANAGEMENT ENDPOINTS
  // =========================================================================

  // -------------------------------------------------------------------------
  // GET /api/v1/ai/performance/alerts
  // List alerts (with filters)
  // -------------------------------------------------------------------------
  fastify.get(
    '/alerts',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')] },
    async (req, reply) => {
      try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
        const { internId, status, severity, alertType } = req.query;

        // Validate internId if provided
        if (internId) {
          const allowed = await assertAccess(req, reply, internId);
          if (!allowed) return;
        }

        const result = await alertRepo.listAlerts({
          internId,
          status: status ? [status] : ['ACTIVE', 'ACKNOWLEDGED'],
          severity,
          alertType,
          requestingUserId: req.user.id,
          requestingUserRole: req.user.role,
          page,
          limit,
        });

        return result;
      } catch (err) {
        req.log.error(err, 'Failed to list alerts');
        return reply.status(500).send({ error: 'Failed to retrieve alerts' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // PATCH /api/v1/ai/performance/alerts/:alertId/acknowledge
  // -------------------------------------------------------------------------
  fastify.patch(
    '/alerts/:alertId/acknowledge',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')] },
    async (req, reply) => {
      const { alertId } = req.params;

      // Validate UUID
      if (!/^[0-9a-f-]{36}$/i.test(alertId)) {
        return reply.status(400).send({ error: 'Invalid alert ID' });
      }

      // Check the alert belongs to an intern the user can access
      const alert = await alertRepo.getAlertById(alertId);
      if (!alert) {
        return reply.status(404).send({ error: 'Alert not found' });
      }

      const allowed = await assertAccess(req, reply, alert.intern_id);
      if (!allowed) return;

      try {
        const updated = await alertRepo.acknowledgeAlert(alertId, req.user.id);

        await auditRepo.logEvent({
          userId: req.user.id,
          action: 'PERF_ALERT_ACKNOWLEDGED',
          resourceType: 'performance_alert',
          resourceId: alertId,
          details: { intern_id: alert.intern_id, alert_type: alert.alert_type },
        });

        return updated;
      } catch (err) {
        return reply
          .status(err.statusCode || 500)
          .send({ error: err.message || 'Failed to acknowledge alert' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // PATCH /api/v1/ai/performance/alerts/:alertId/resolve
  // -------------------------------------------------------------------------
  fastify.patch(
    '/alerts/:alertId/resolve',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')] },
    async (req, reply) => {
      const { alertId } = req.params;

      if (!/^[0-9a-f-]{36}$/i.test(alertId)) {
        return reply.status(400).send({ error: 'Invalid alert ID' });
      }

      const note = req.body?.note;
      if (
        note !== undefined &&
        (typeof note !== 'string' || note.length > 500)
      ) {
        return reply
          .status(400)
          .send({ error: 'note must be a string of max 500 characters' });
      }

      const alert = await alertRepo.getAlertById(alertId);
      if (!alert) {
        return reply.status(404).send({ error: 'Alert not found' });
      }

      const allowed = await assertAccess(req, reply, alert.intern_id);
      if (!allowed) return;

      try {
        const updated = await alertRepo.resolveAlert(
          alertId,
          req.user.id,
          note
        );

        await auditRepo.logEvent({
          userId: req.user.id,
          action: 'PERF_ALERT_RESOLVED',
          resourceType: 'performance_alert',
          resourceId: alertId,
          details: {
            intern_id: alert.intern_id,
            alert_type: alert.alert_type,
            note,
          },
        });

        return updated;
      } catch (err) {
        return reply
          .status(err.statusCode || 500)
          .send({ error: err.message || 'Failed to resolve alert' });
      }
    }
  );
}

module.exports = routes;
