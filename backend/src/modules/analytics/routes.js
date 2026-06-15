const { z } = require('zod');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');

async function routes(fastify) {
  fastify.get(
    '/overview',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
    async () => {
      const pool = require('../../config/db');
      const counts = await pool.query(
        'SELECT role, COUNT(*) FROM users WHERE deleted_at IS NULL GROUP BY role'
      );
      return { users: counts.rows };
    }
  );

  // Department attendance rate (admin/senior TL)
  fastify.get(
    '/department-attendance',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
    async (req) => {
      const { departmentId, month, year } = req.query;
      if (!departmentId || !month || !year)
        throw new Error('departmentId, month, year required');
      return repo.departmentAttendanceRate(departmentId, month, year);
    }
  );

  // Top performers (Fully Secured & Optimized)
  fastify.get(
    '/top-performers',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')] },
    async (req, reply) => {
      // 1. Define strict validation schema
      const schema = z.object({
        role: z
          .enum(['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'])
          .default('INTERN'),
        limit: z.coerce.number().int().min(1).max(50).default(10),
      });

      // 2. Parse data safely and catch malformed inputs
      const result = schema.safeParse(req.query);
      if (!result.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid query parameters provided.',
          details: result.error.format(),
        });
      }

      const { role, limit } = result.data;

      // 3. Define the strict ceiling matrix for visibility boundaries
      const permittedRoles = {
        ADMIN: ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'],
        SENIOR_TL: ['TL', 'CAPTAIN', 'INTERN'],
        TL: ['CAPTAIN', 'INTERN'],
      };

      // 4. Enforce authorization boundary check
      const userRole = req.user?.role; // Safe navigation operator in case req.user is malformed
      if (!userRole || !permittedRoles[userRole]?.includes(role)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Access Denied: Your role (${userRole || 'UNKNOWN'}) cannot query top performers for the ${role} tier.`,
        });
      }

      // 5. Execute secure repository fetch
      return repo.topPerformers(role, limit);
    }
  );

  // Attendance trends
  fastify.get(
    '/attendance-trends',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')] },
    async (req, reply) => {
      const schema = z.object({
        months: z.coerce.number().int().min(1).max(24).default(6),
        departmentId: z.string().uuid().optional(),
      });
      const { months, departmentId } = schema.parse(req.query);
      const scopedDeptId =
        req.user.role === 'ADMIN' ? departmentId : req.user.departmentId;
      return repo.attendanceTrends(months, scopedDeptId);
    }
  );
}

module.exports = routes;
