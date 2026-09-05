const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');
const emailService = require('../../services/email');
const { runWithConcurrencyLimit } = require('../../utils/concurrency');
const aiDraftService = require('./ai-draft.service');
const aiRepo = require('../ai/repository');
const config = require('../../config');

const EMAIL_BATCH_SIZE = 500;
const EMAIL_CONCURRENCY = 10;
const AI_TASK_DRAFT_RATE_LIMIT = Number(
  process.env.AI_TASK_DRAFT_RATE_LIMIT_PER_MIN || 5
);

const aiDraftSchema = z.object({
  brief: z.string().trim().min(3).max(500),
});
const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  targetPlatform: z.string().max(100).optional(),
  taskLink: z.string().max(500).optional(),
  deadline: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional()
    .refine(
      (v) => !v || !Number.isNaN(Date.parse(v)),
      'deadline must be a valid ISO date'
    )
    .refine(
      (v) => !v || new Date(v).getTime() > Date.now(),
      'deadline must be in the future'
    ),
  imagePath: z.string().max(500).optional(),
});

const assignTaskSchema = z.object({
  userIds: z.array(z.string().uuid()),
});

// Added submission validation schema with custom refinement rule
const submitProofSchema = z
  .object({
    proofUrl: z.string().url(),
    did_comment: z.boolean().default(false),
    did_repost: z.boolean().default(false),
    did_share: z.boolean().default(false),
  })
  .refine((data) => data.did_comment || data.did_repost || data.did_share, {
    message:
      'You must perform at least one action (Comment, Repost, or Share) to submit proof.',
    path: ['did_comment'],
  });

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  targetPlatform: z.string().max(100).optional(),
  taskLink: z.string().max(500).optional(),
  deadline: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional()
    .refine(
      (v) => !v || !Number.isNaN(Date.parse(v)),
      'deadline must be a valid ISO date'
    )
    .refine(
      (v) => !v || new Date(v).getTime() > Date.now(),
      'deadline must be in the future'
    ),
});
async function notifyAllInternsAsync(task, log) {
  try {
    const startTime = Date.now();
    const totalCount = await repo.getInternEmailCount();

    if (totalCount === 0) {
      log.info({ taskId: task.id }, 'No interns found to notify');
      return;
    }

    let offset = 0;
    let totalSent = 0;
    let totalFailed = 0;

    while (offset < totalCount) {
      const emails = await repo.getAllInternEmails(EMAIL_BATCH_SIZE, offset);
      if (emails.length === 0) break;

      const results = await runWithConcurrencyLimit(
        emails,
        (email) =>
          emailService.sendNotification(email, {
            title: 'New Social Media Task',
            message: `A new task "${task.title}" has been posted. Please complete it before the deadline.`,
          }),
        EMAIL_CONCURRENCY
      );

      const failed = results.filter((r) => r.status === 'rejected');
      totalSent += results.length - failed.length;
      totalFailed += failed.length;

      if (failed.length > 0) {
        log.warn(
          { failedCount: failed.length, sample: failed[0].reason?.message },
          'Some intern notification emails failed in batch'
        );
      }

      offset += EMAIL_BATCH_SIZE;
    }

    log.info(
      {
        taskId: task.id,
        totalSent,
        totalFailed,
        durationMs: Date.now() - startTime,
      },
      'Finished sending intern task notifications'
    );
  } catch (err) {
    log.warn(
      { err, taskId: task.id },
      'Task created but bulk intern notification process failed'
    );
  }
}

module.exports = async function socialTasksRoutes(fastify) {
  // Create a social task (Admin / Senior TL).
  fastify.post(
    '/',
    {
      schema: { tags: ['Tasks'], description: 'Create a social task' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const parsed = createTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }
      const data = parsed.data;

      const task = await repo.createTask({ ...data, createdBy: req.user.id });
      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'TASK_CREATED',
        resourceType: 'social_task',
        resourceId: task.id,
        details: { title: task.title },
      };
      void (async () => {
        try {
          const creatorEmail = await repo.getUserEmail(req.user.id);

          if (creatorEmail) {
            await emailService.sendNotification(creatorEmail, {
              title: 'Task Created',
              message: `Task "${task.title}" has been created successfully.`,
              recipient: req.user.id,
            });
          }
        } catch (emailErr) {
          req.log.warn(
            { emailErr },
            'Task created but creator notification email failed'
          );
        }
      })();

      void notifyAllInternsAsync(task, req.log);

      return task;
    }
  );

  // Draft a social task from a short brief using AI (Admin / Senior TL).
  // The draft is never persisted or auto-published — it is only returned
  // for the creator to review, edit, and explicitly submit via POST /.
  fastify.post(
    '/ai-draft',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Generate a draft task from a short brief using AI',
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
      config: {
        rateLimit: {
          max: AI_TASK_DRAFT_RATE_LIMIT,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.user?.id || req.ip,
        },
      },
    },
    async (req, reply) => {
      const parsed = aiDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      try {
        // Per-creator daily cap on top of the per-minute rate limit above,
        // so a single creator can't run up the AI bill on their own.
        const usageResult = await aiRepo.tryIncrementUsage(
          req.user.id,
          config.ai.dailyLimit
        );

        if (!usageResult) {
          return reply.status(429).send({
            error: 'Daily AI usage limit exceeded',
          });
        }

        const draft = await aiDraftService.generateTaskDraft({
          brief: parsed.data.brief,
          creatorId: req.user.id,
        });

        return draft;
      } catch (error) {
        if (error.statusCode === 400) {
          return reply.status(400).send({ error: error.message });
        }
        if (error.statusCode === 413) {
          return reply.status(413).send({
            error: 'AI provider response too large',
          });
        }

        req.log.error(
          { err: error.message, code: error.statusCode },
          'AI task draft generation failed'
        );
        return reply.status(503).send({
          error: 'AI drafting service unavailable',
        });
      }
    }
  );

  // Update a social task (Admin / Senior TL).
  fastify.patch(
    '/:id',
    {
      schema: { tags: ['Tasks'], description: 'Update a social task' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const parsed = updateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.issues });
      }
      const task = await repo.updateTask(req.params.id, parsed.data);
      if (!task) return reply.status(404).send({ error: 'Task not found' });
      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'TASK_UPDATED',
        resourceType: 'social_task',
        resourceId: task.id,
        details: parsed.data,
      };
      if (task.source === 'github' && task.github_issue_number) {
        setImmediate(async () => {
          try {
            const githubSync = require('../github-sync/service');
            await githubSync.syncTaskToGithub(task.id, req.user.id);
          } catch (syncErr) {
            req.log.warn(
              { taskId: task.id, err: syncErr.message },
              'Two-way GitHub sync failed'
            );
          }
        });
      }
      return task;
    }
  );

  // Delete a social task (Admin / Senior TL).
  fastify.delete(
    '/:id',
    {
      schema: { tags: ['Tasks'], description: 'Delete a social task' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      const task = await repo.getTaskById(req.params.id);
      await repo.deleteTask(req.params.id);
      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'TASK_DELETED',
        resourceType: 'social_task',
        resourceId: req.params.id,
        details: {},
      };
      if (task && task.source === 'github' && task.github_issue_number) {
        setImmediate(async () => {
          try {
            const githubSync = require('../github-sync/service');
            await githubSync.closeGithubIssueFromTask(task.id, req.user.id);
          } catch (syncErr) {
            req.log.warn(
              { taskId: task.id, err: syncErr.message },
              'GitHub issue close on delete failed'
            );
          }
        });
      }
      return { success: true };
    }
  );

  fastify.post(
    '/:id/assign',
    {
      schema: { tags: ['Tasks'], description: 'Assign task to interns' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const parsed = assignTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      // Verify task exists before assigning (#988)
      const task = await repo.getTaskById(req.params.id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const { userIds } = parsed.data;
      if (userIds.length > 0) {
        await repo.assignTask(req.params.id, userIds, req.user.id);
      }

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'TASK_ASSIGNED',
        resourceType: 'social_task',
        resourceId: req.params.id,
        details: { userIds },
      };

      return { success: true };
    }
  );

  // List social tasks (any authenticated user).
  // Optional query params: ?deadlineBefore=ISO date, ?source=github|manual
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Tasks'],
        description: 'List social tasks',
        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            deadlineBefore: {
              type: 'string',
            },
            department_id: {
              type: 'string',
            },
            source: {
              type: 'string',
              enum: ['manual', 'github'],
            },
          },
        },
      },
      preHandler: [auth],
    },
    async (req) => {
      return repo.getTasks(
        req.query || {},
        req.user.id,
        req.user.role,
        req.query.page,
        req.query.limit
      );
    }
  );

  // Submit proof for a task (Interns only)
  fastify.post(
    '/:id/submit',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Submit task proof with engagement actions',
      },
      preHandler: [auth, rbac('INTERN'), sanitize],
    },
    async (req, reply) => {
      const parsed = submitProofSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      const { proofUrl, did_comment, did_repost, did_share } = parsed.data;

      const submission = await repo.submitProof({
        taskId: req.params.id,
        internId: req.user.id,
        proofUrl,
        did_comment,
        did_repost,
        did_share,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'PROOF_SUBMITTED',
        resourceType: 'proof_submission',
        resourceId: req.params.id,
        details: { did_comment, did_repost, did_share },
      };

      return submission;
    }
  );

  // Get task by ID (Authenticated users)
  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Tasks'],
        description: 'Get task details by ID',
      },
      preHandler: [auth],
    },
    async (req, reply) => {
      const task = await repo.getTaskById(req.params.id);
      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }
      return task;
    }
  );

  // Get task analytics and department-wise completion stats (Admin & Senior TL)
  fastify.get(
    '/:id/analytics',
    {
      schema: {
        tags: ['Tasks'],
        description:
          'Get task analytics and department-wise completion breakdown',
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      const analytics = await repo.getTaskAnalytics(req.params.id);
      if (!analytics) {
        return reply.status(404).send({ error: 'Task not found' });
      }
      return analytics;
    }
  );
};
