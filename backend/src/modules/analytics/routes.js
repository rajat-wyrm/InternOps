const { z } = require('zod');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');

async function routes(fastify) {
  fastify.get('/overview', { preHandler: [auth, rbac('ADMIN','SENIOR_TL')] }, async () => {
    const pool = require('../../config/db');
    const counts = await pool.query("SELECT role, COUNT(*) FROM users WHERE deleted_at IS NULL GROUP BY role");
    return { users: counts.rows };
  });

  // Department attendance rate (admin/senior TL)
  fastify.get('/department-attendance', { preHandler: [auth, rbac('ADMIN','SENIOR_TL')] }, async (req) => {
    const { departmentId, month, year } = req.query;
    if (!departmentId || !month || !year) throw new Error('departmentId, month, year required');
    return repo.departmentAttendanceRate(departmentId, month, year);
  });

  // Top performers
  fastify.get('/top-performers', { preHandler: [auth, rbac('ADMIN','SENIOR_TL','TL')] }, async (req) => {
    const { role = 'INTERN', limit = 10 } = req.query;
    return repo.topPerformers(role, limit);
  });

  // Attendance trends
  fastify.get('/attendance-trends', { preHandler: [auth, rbac('ADMIN','SENIOR_TL')] }, async (req, reply) => {
    const schema = z.object({
      months: z.coerce.number().int().min(1).max(24).default(6),
      departmentId: z.string().uuid().optional()
    });
    const { months, departmentId } = schema.parse(req.query);
    const scopedDeptId = req.user.role === 'ADMIN' ? departmentId : req.user.departmentId;
    return repo.attendanceTrends(months, scopedDeptId);
  });
}

module.exports = routes;
