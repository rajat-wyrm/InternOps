const pool = require('../../config/db');
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

      const { rows } = await pool.query(
        `SELECT d.name AS department,
                COUNT(a.id) AS total,
                SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN a.status='HALF_DAY' THEN 1 ELSE 0 END) AS half_day
         FROM attendance a
         JOIN users u ON a.user_id = u.id
         JOIN departments d ON u.department_id = d.id AND d.deleted_at IS NULL
         WHERE ${where.join(' AND ')}
         GROUP BY d.id, d.name ORDER BY d.name`,
        params
      );
      return rows;
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

      const { rows } = await pool.query(
        `SELECT DATE(a.date) AS date,
                COUNT(*) AS total,
                SUM(CASE WHEN a.status='PRESENT' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN a.status='ABSENT' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN a.status='HALF_DAY' THEN 1 ELSE 0 END) AS half_day
         FROM attendance a
         WHERE a.date BETWEEN $1 AND $2
           AND a.deleted_at IS NULL
         GROUP BY DATE(a.date)
         ORDER BY DATE(a.date)`,
        [range.from, range.to]
      );

      return rows;
    }
  );
}

module.exports = routes;
