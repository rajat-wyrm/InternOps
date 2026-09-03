const auth = require('../../middleware/auth');
const { toSchema } = require('../../utils/schemaHelper');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { z } = require('zod');

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
});

function parseDateRange(query) {
  const parsed = dateRangeSchema.safeParse(query);

  if (!parsed.success) {
    const error = new Error('from and to are required (YYYY-MM-DD)');
    error.statusCode = 400;
    error.details = parsed.error.issues;
    throw error;
  }

  return parsed.data;
}

// Escape any cell that starts with a spreadsheet formula trigger so a
// crafted task title cannot inject formulas (=, +, -, @, tab, CR).
function csvCell(value) {
  const s = String(value ?? '');
  const escaped = s.replace(/"/g, '""');

  if (/^[=+\-@\t\r]/.test(s)) {
    return `"'${escaped}"`;
  }

  if (/[",\n]/.test(s)) {
    return `"${escaped}"`;
  }

  return s;
}

async function routes(fastify) {
  fastify.get(
    '/attendance-detail-csv',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')],
      schema: {
        tags: ['Reports'],
        description: 'Export detailed historical attendance CSV',
      },
    },
    async (req, reply) => {
      const range = parseDateRange(req.query);
      const rows = await repo.detailedAttendanceExport(
        req.query.department_id || null,
        range.from,
        range.to
      );
      const csv = ['Member,Email,Role,Lifecycle Status,Date,Attendance,Remarks']
        .concat(
          rows.map((r) =>
            [
              r.full_name,
              r.email,
              r.role,
              r.internship_status,
              String(r.date).slice(0, 10),
              r.status,
              r.remarks,
            ]
              .map(csvCell)
              .join(',')
          )
        )
        .join('\n');
      return reply
        .header('Content-Type', 'text/csv')
        .header(
          'Content-Disposition',
          `attachment; filename="attendance-${range.from}-to-${range.to}.csv"`
        )
        .send(csv);
    }
  );

  fastify.get(
    '/attendance-csv',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
      schema: {
        tags: ['Reports'],
        description: 'Export attendance as CSV',
        querystring: toSchema(dateRangeSchema),
      },
    },
    async (req, reply) => {
      const range = parseDateRange(req.query);
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
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
      schema: {
        tags: ['Reports'],
        description: 'Export ratings as CSV',
        querystring: toSchema(dateRangeSchema),
      },
    },
    async (req, reply) => {
      const range = parseDateRange(req.query);
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
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
      schema: {
        tags: ['Reports'],
        description: 'Export task completion as CSV',
      },
    },
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
module.exports.csvCell = csvCell;
