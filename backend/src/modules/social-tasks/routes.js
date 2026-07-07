const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');
const emailService = require('../../services/email');

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
    ),
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
          'Task created but notification email failed'
        );
      }
      try {
        const internEmails = await repo.getAllInternEmails();

        for (const email of internEmails) {
          await emailService.sendNotification(email, {
            title: 'New Social Media Task',
            message: `A new task "${task.title}" has been posted. Please complete it before the deadline.`,
          });
        }
      } catch (emailErr) {
        req.log.warn(
          { emailErr },
          'Task created but intern notification emails failed'
        );
      }
      return task;
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

  // List social tasks (any authenticated user). Optional ?deadlineBefore=ISO date.
  fastify.get(
    '/',
    {
      schema: { tags: ['Tasks'], description: 'List social tasks' },
      preHandler: [auth],
    },
    async (req) => {
      return repo.getTasks(req.query || {}, req.user.id, req.user.role);
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
};
