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

// Escape any cell that starts with a spreadsheet formula trigger so a
// crafted task title cannot inject formulas (=, +, -, @, tab, CR).
function csvCell(value) {
  const s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) {
    return `"${'"'}${s.replace(/"/g, '""')}"`;
  }
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function routes(fastify) {
  fastify.get(
    '/attendance-csv',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
    async (req, reply) => {
      const range = parseDateRange(req.query, reply);
      if (!range) return;
      const data = await repo.attendanceSummaryByRole(range.from, range.to);
      const csv = ['Role,Status,Count']
        .concat(
          data.map((r) => `${csvCell(r.role)},${csvCell(r.status)},${r.count}`)
        )
        .join('\n');
      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename=attendance.csv')
        .send(csv);
    }
  );

  fastify.get(
    '/ratings-csv',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
    async (req, reply) => {
      const range = parseDateRange(req.query, reply);
      if (!range) return;
      const data = await repo.ratingsSummary(range.from, range.to);
      const csv = ['Role,Average Score,Total Ratings']
        .concat(
          data.map(
            (r) =>
              `${csvCell(r.role)},${parseFloat(r.avg_score).toFixed(
                2
              )},${r.total}`
          )
        )
        .join('\n');
      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename=ratings.csv')
        .send(csv);
    }
  );

  fastify.get(
    '/tasks-csv',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
    async (req, reply) => {
      const data = await repo.taskCompletionStats();
      const csv = ['Task Title,Verified,Pending']
        .concat(
          data.map((t) => `${csvCell(t.title)},${t.verified},${t.pending}`)
        )
        .join('\n');
      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename=tasks.csv')
        .send(csv);
    }
  );
}

module.exports = routes;
