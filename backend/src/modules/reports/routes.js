const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { z } = require('zod');

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
});

function parseDateRange(query, reply) {
  const parsed = dateRangeSchema.safeParse(query);
  if (!parsed.success) {
    reply.status(400).send({
      error: 'from and to are required (YYYY-MM-DD)',
      details: parsed.error.issues,
    });
    return null;
  }
  return parsed.data;
}

async function routes(fastify) {
  fastify.get(
    '/attendance-summary',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      const range = parseDateRange(req.query, reply);
      if (!range) return;
      return repo.attendanceSummaryByRole(range.from, range.to);
    }
  );

  fastify.get(
    '/ratings-summary',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      const range = parseDateRange(req.query, reply);
      if (!range) return;
      return repo.ratingsSummary(range.from, range.to);
    }
  );

  fastify.get(
    '/task-completion',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async () => {
      return repo.taskCompletionStats();
    }
  );

  fastify.get(
    '/department-attendance',
    {
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const schema = z.object({
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD')
          .optional(),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD')
          .optional(),
        departmentId: z.string().uuid().optional(),
      });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: parsed.error.issues,
        });
      }
      const { from, to, departmentId } = parsed.data;

      const where = ['a.deleted_at IS NULL'];
      const params = [];
      if (from) {
        params.push(from);
        where.push(`a.date >= $${params.length}`);
      }
      if (to) {
        params.push(to);
        where.push(`a.date <= $${params.length}`);
      }
      if (departmentId) {
        params.push(departmentId);
        where.push(`d.id = $${params.length}`);
      }

      return repo.departmentAttendance(where.join(' AND '), params);
    }
  );

  fastify.get(
    '/custom-summary',
    {
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const range = parseDateRange(req.query, reply);
      if (!range) return;

      return repo.customSummary(range.from, range.to);
    }
  );
}

module.exports = routes;
