const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const service = require('./service');
const orchestrator = require('./orchestrator');
const { z } = require('zod');

const syncRequestSchema = z.object({
  repo: z.string().min(1).max(255).optional(),
});

const settingsUpdateSchema = z.object({
  repo: z.string().min(1).max(255).optional(),
  webhookSecret: z.string().min(1).max(255).optional(),
  githubToken: z.string().min(1).max(255).optional(),
});

module.exports = async function githubSyncRoutes(fastify) {
  // POST /webhook — Receive GitHub webhook events (NO auth — uses HMAC)
  fastify.post(
    '/webhook',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Receive GitHub webhook events for issue sync',
        hide: true,
      },
      config: { rawBody: true },
    },
    async (req, reply) => {
      const signature = req.headers['x-hub-signature-256'];
      const event = req.headers['x-github-event'];
      const deliveryId = req.headers['x-github-delivery'];

      if (!event) {
        return reply.status(400).send({
          received: false,
          error: 'Missing x-github-event header',
        });
      }

      if (!deliveryId) {
        return reply.status(400).send({
          received: false,
          error: 'Missing x-github-delivery header',
        });
      }

      const rawBody = req.body;
      if (!rawBody) {
        return reply.status(400).send({
          received: false,
          error: 'Empty request body',
        });
      }

      let payload;
      if (typeof rawBody === 'string') {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return reply.status(400).send({
            received: false,
            error: 'Invalid JSON payload',
          });
        }
      } else {
        payload = rawBody;
      }

      const isValid = service.verifyWebhookSignature(rawBody, signature);

      if (!isValid) {
        await repo.logSyncEvent({
          eventType: event,
          action: 'invalid_signature',
          githubRepo: payload?.repository?.full_name || null,
          status: 'failed',
          message: 'Webhook signature verification failed',
          details: {
            deliveryId,
            hasSignature: !!signature,
          },
          triggeredBy: payload?.sender?.login || 'unknown',
        });
        return reply.status(401).send({
          received: false,
          error: 'Invalid webhook signature',
        });
      }

      try {
        const result = await service.handleWebhookEvent(event, payload);
        return {
          received: true,
          event,
          action: result.action || null,
          processed: true,
          taskId: result.task?.id || null,
          message: result.message || 'Event processed successfully',
        };
      } catch (err) {
        req.log.error({ err, event, deliveryId }, 'Webhook handler failed');
        await repo.logSyncEvent({
          eventType: event,
          action: 'error',
          githubRepo: payload?.repository?.full_name || null,
          status: 'failed',
          message: `Webhook handler error: ${err.message}`,
          details: { error: err.message, stack: err.stack?.substring(0, 500) },
          triggeredBy: payload?.sender?.login || 'unknown',
        });
        return reply.status(500).send({
          received: true,
          event,
          processed: false,
          error: 'Internal error processing webhook',
        });
      }
    }
  );

  // POST /sync — Manually trigger sync of all open issues (Admin only)
  fastify.post(
    '/sync',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Manually sync all open GitHub issues as tasks',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const parsed = syncRequestSchema.safeParse(req.body || {});
      const repoName =
        parsed.success && parsed.data.repo
          ? parsed.data.repo
          : service.getDefaultRepo();

      reply.status(202).send({
        message: `Sync started for ${repoName}. This may take a while.`,
        repo: repoName,
        status: 'in_progress',
      });

      try {
        const results = await service.syncAllOpenIssues(repoName);
        req.log.info({ repo: repoName, results }, 'GitHub sync completed');
      } catch (err) {
        req.log.error({ err, repo: repoName }, 'GitHub sync failed');
      }
    }
  );

  // GET /status — Get sync status and stats (Admin only)
  fastify.get(
    '/status',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Get GitHub sync configuration and stats',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      const stats = await repo.getSyncStats();
      const recentLogs = await repo.getRecentSyncLogs(20);
      const settings = await repo.getGithubSyncSettings();
      return {
        configured: stats.configured,
        repo: stats.repo,
        webhookSecretConfigured: !!service.getWebhookSecret(),
        githubTokenConfigured: !!service.getGithubToken(),
        lastSyncAt: stats.lastSyncAt,
        lastPingAt: stats.lastPingAt,
        totalSynced: stats.totalSynced,
        successfulEvents: stats.successful,
        failedEvents: stats.failed,
        skippedEvents: stats.skipped,
        webhookEndpoint: '/api/v1/github/webhook',
        recentLogs,
      };
    }
  );

  // GET /settings — Get current settings (Admin only)
  fastify.get(
    '/settings',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Get GitHub sync settings',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      const settings = await repo.getGithubSyncSettings();
      if (!settings) {
        return {
          configured: false,
          repo: service.getDefaultRepo(),
          isActive: false,
        };
      }
      return {
        configured: true,
        id: settings.id,
        repo: settings.repo,
        isActive: settings.is_active,
        lastPingAt: settings.last_ping_at,
        lastSyncAt: settings.last_sync_at,
        totalIssuesSynced: settings.total_issues_synced,
        failedSyncs: settings.failed_syncs,
        createdAt: settings.created_at,
        updatedAt: settings.updated_at,
      };
    }
  );

  // PUT /settings — Update settings (Admin only)
  fastify.put(
    '/settings',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Update GitHub sync settings',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const parsed = settingsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }
      const settings = await repo.upsertGithubSyncSettings({
        repo: parsed.data.repo,
        webhookSecret: parsed.data.webhookSecret,
        githubToken: parsed.data.githubToken,
        isActive: true,
      });
      return {
        success: true,
        message: 'Settings updated successfully',
        settings: {
          repo: settings.repo,
          isActive: settings.is_active,
          lastPingAt: settings.last_ping_at,
          lastSyncAt: settings.last_sync_at,
        },
      };
    }
  );

  // GET /logs — Get sync logs (Admin only)
  fastify.get(
    '/logs',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Get recent GitHub sync logs',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      const limit = Math.min(Number(req.query?.limit) || 50, 200);
      const logs = await repo.getRecentSyncLogs(limit);
      return logs;
    }
  );

  // GET /orchestrator — Get orchestrator health status (Admin only)
  fastify.get(
    '/orchestrator',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Get sync orchestrator health and status',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      const status = await orchestrator.getOrchestratorStatus();
      return status;
    }
  );

  // POST /retry — Manually trigger retry of failed syncs (Admin only)
  fastify.post(
    '/retry',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Manually retry all failed sync events',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      reply.status(202).send({
        message: 'Retry triggered. Check logs for results.',
        status: 'in_progress',
      });
      orchestrator.retryFailedSyncs();
    }
  );

  // GET /issues — List all synced issues (Admin only)
  fastify.get(
    '/issues',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'List all synced GitHub issues',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      return repo.getAllSyncedIssues(req.query?.page, req.query?.limit);
    }
  );

  // DELETE /logs/cleanup — Clean old logs (Admin only)
  fastify.delete(
    '/logs/cleanup',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Delete sync logs older than specified days',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const days = Math.min(Number(req.query?.days) || 90, 365);
      const deleted = await repo.deleteSyncLogsOlderThan(days);
      return { success: true, deletedCount: deleted, olderThanDays: days };
    }
  );

  // POST /webhook/register — Auto-register webhook on GitHub (Admin only)
  fastify.post(
    '/webhook/register',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Register webhook on GitHub via API',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const repoName = req.body?.repo || service.getDefaultRepo();
      try {
        const result = await service.registerWebhook(repoName);
        await repo.logSyncEvent({
          eventType: 'webhook',
          action: 'register',
          githubRepo: repoName,
          status: 'success',
          message: result.alreadyExists
            ? 'Webhook already registered'
            : 'Webhook registered successfully',
          details: result,
          triggeredBy: req.user.id,
        });
        return result;
      } catch (err) {
        await repo.logSyncEvent({
          eventType: 'webhook',
          action: 'register',
          githubRepo: repoName,
          status: 'failed',
          message: err.message,
          triggeredBy: req.user.id,
        });
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /webhook/unregister — Unregister webhook (Admin only)
  fastify.post(
    '/webhook/unregister',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Unregister webhook on GitHub',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const repoName = req.body?.repo || service.getDefaultRepo();
      const hookId = req.body?.hookId;
      if (!hookId)
        return reply.status(400).send({ error: 'hookId is required' });
      try {
        const result = await service.unregisterWebhook(repoName, hookId);
        await repo.logSyncEvent({
          eventType: 'webhook',
          action: 'unregister',
          githubRepo: repoName,
          status: 'success',
          message: 'Webhook unregistered',
          triggeredBy: req.user.id,
        });
        return result;
      } catch (err) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // GET /rate-limit — Check GitHub API rate limit status (Admin only)
  fastify.get(
    '/rate-limit',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Check GitHub API rate limit',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      try {
        return await service.getRateLimitStatus();
      } catch (err) {
        return { error: err.message };
      }
    }
  );

  // POST /sync-task/:taskId — Manually sync a single task to GitHub (Admin only)
  fastify.post(
    '/sync-task/:taskId',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Push task changes back to GitHub issue',
        params: {
          type: 'object',
          properties: {
            taskId: { type: 'string', format: 'uuid' },
          },
          required: ['taskId'],
        },
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      try {
        const result = await service.syncTaskToGithub(
          req.params.taskId,
          req.user.id
        );
        if (!result.success) {
          return reply.status(400).send({
            error: 'Sync failed',
            statusCode: result.statusCode,
            details: result.githubResponse || null,
          });
        }
        return {
          success: true,
          message: `Task synced to GitHub issue #${result.task?.github_issue_number || ''}`,
          ...result,
        };
      } catch (err) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /sync-task/:taskId/close — Close GitHub issue from task (Admin only)
  fastify.post(
    '/sync-task/:taskId/close',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Close the linked GitHub issue',
        params: {
          type: 'object',
          properties: {
            taskId: { type: 'string', format: 'uuid' },
          },
          required: ['taskId'],
        },
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      try {
        const result = await service.closeGithubIssueFromTask(
          req.params.taskId,
          req.user.id
        );
        if (!result.success && result.reason) {
          return reply
            .status(400)
            .send({ error: `Cannot close: ${result.reason}` });
        }
        return { success: true, message: 'GitHub issue closed', ...result };
      } catch (err) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /sync-task/:taskId/reopen — Reopen GitHub issue from task (Admin only)
  fastify.post(
    '/sync-task/:taskId/reopen',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Reopen the linked GitHub issue',
        params: {
          type: 'object',
          properties: {
            taskId: { type: 'string', format: 'uuid' },
          },
          required: ['taskId'],
        },
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      try {
        const result = await service.reopenGithubIssueFromTask(
          req.params.taskId,
          req.user.id
        );
        if (!result.success && result.reason) {
          return reply
            .status(400)
            .send({ error: `Cannot reopen: ${result.reason}` });
        }
        return { success: true, message: 'GitHub issue reopened', ...result };
      } catch (err) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /sync-task/batch — Batch sync multiple tasks (Admin only)
  const batchSyncSchema = z.object({
    taskIds: z.array(z.string()).min(1).max(50),
  });

  fastify.post(
    '/sync-task/batch',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Batch sync multiple tasks to GitHub',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const parsed = batchSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.issues });
      }
      reply.status(202).send({
        message: `Batch sync started for ${parsed.data.taskIds.length} tasks`,
        status: 'in_progress',
      });
      service.updateGithubIssueStatusBatch(parsed.data.taskIds, req.user.id);
    }
  );

  // POST /sync-task/:taskId/comments — Sync comments for a task (Admin only)
  fastify.post(
    '/sync-task/:taskId/comments',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Fetch and store GitHub issue comments',
        params: {
          type: 'object',
          properties: {
            taskId: { type: 'string', format: 'uuid' },
          },
          required: ['taskId'],
        },
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      try {
        const task = await repo.getGithubTaskInfo(req.params.taskId);
        if (!task || task.source !== 'github') {
          return reply
            .status(400)
            .send({ error: 'Task is not GitHub-sourced' });
        }
        const comments = await service.syncIssueComments(
          task.id,
          task.github_repo,
          task.github_issue_number
        );
        return { success: true, ...comments };
      } catch (err) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // GET /sync/log — Get two-way sync log (Admin only)
  fastify.get(
    '/sync/log',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Get two-way sync activity log',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      const limit = Math.min(Number(req.query?.limit) || 50, 200);
      return service.getTwoWaySyncLog(limit);
    }
  );

  // GET /stats/analytics — Get detailed analytics with daily/weekly trends (Admin only)
  fastify.get(
    '/stats/analytics',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Get detailed sync analytics with daily trends',
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
          },
        },
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      const days = Math.min(Number(req.query?.days) || 30, 365);
      return repo.getSyncAnalytics(days);
    }
  );

  // GET /stats/count — Get sync count summary (Admin only)
  fastify.get(
    '/stats/count',
    {
      schema: {
        tags: ['GitHub Sync'],
        description: 'Get summary counts of synced items',
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req) => {
      const pool = require('../../config/db');
      const [githubTasks, totalTasks, byRepo, byPlatform] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS count FROM social_tasks WHERE source = 'github' AND deleted_at IS NULL`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM social_tasks WHERE deleted_at IS NULL`
        ),
        pool.query(
          `SELECT github_repo, COUNT(*)::int AS count FROM social_tasks WHERE source = 'github' AND deleted_at IS NULL GROUP BY github_repo ORDER BY count DESC`
        ),
        pool.query(
          `SELECT target_platform, COUNT(*)::int AS count FROM social_tasks WHERE source = 'github' AND deleted_at IS NULL GROUP BY target_platform ORDER BY count DESC`
        ),
      ]);
      return {
        totalGithubTasks: githubTasks.rows[0].count,
        totalAllTasks: totalTasks.rows[0].count,
        githubPercentage:
          totalTasks.rows[0].count > 0
            ? Math.round(
                (githubTasks.rows[0].count / totalTasks.rows[0].count) * 100
              )
            : 0,
        byRepo: byRepo.rows,
        byPlatform: byPlatform.rows,
      };
    }
  );
};
