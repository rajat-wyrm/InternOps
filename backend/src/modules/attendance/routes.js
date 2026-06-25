const { notifyUser } = require('../../websocket');
const auth = require('../../middleware/auth');
const direct = require('../../middleware/directManager');
const ownership = require('../../middleware/ownership');
const rbac = require('../../middleware/rbac');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { send: sendNotification } = require('../notifications/repository');
const { z } = require('zod');

async function routes(fastify) {
  // Mark attendance (manager roles; target must be in the requester's hierarchy)
  fastify.post(
    '/mark',
    {
      schema: { tags: ['Attendance'], description: 'Mark single attendance' },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
    },
    async (req, reply) => {
      const schema = z.object({
        user_id: z.string().uuid(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
        status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY']),
        remarks: z.string().max(500).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }
      const { user_id, date, status, remarks } = parsed.data;

      if (req.user.role !== 'ADMIN' && req.user.id === user_id) {
        return reply
          .status(400)
          .send({ error: 'You cannot mark your own attendance' });
      }

      if (req.user.role !== 'ADMIN') {
        const ok = await checkHierarchyAccess(req.user.id, user_id);
        if (!ok)
          return reply
            .status(403)
            .send({ error: 'This member is not in your team' });
      }
      const att = await repo.markAttendance(
        user_id,
        req.user.id,
        date,
        status,
        remarks
      );
      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'ATTENDANCE_MARKED',
        resourceType: 'attendance',
        resourceId: att.id,
        details: { target: user_id, date, status, remarks },
      };
      await sendNotification(
        user_id,
        `Your attendance for ${date} has been marked as ${status}.`
      );
      await notifyUser(att.user_id, 'attendance-marked', { attendance: att });

      return reply.status(201).send(att);
    }
  );

  // Bulk mark attendance (manager roles, ownership validated per entry)
  fastify.post(
    '/bulk',
    {
      schema: { tags: ['Attendance'], description: 'Bulk mark attendance' },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
    },
    async (req, reply) => {
      const entrySchema = z.object({
        user_id: z.string().uuid(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
        status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY']),
        remarks: z.string().max(500).optional(),
      });
      const bodySchema = z.object({
        entries: z.array(entrySchema).min(1).max(500),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }
      const entries = parsed.data.entries;

      // Authorize all entries in a single recursive query — avoids N+1.
      if (req.user.role !== 'ADMIN') {
        const targetIds = [...new Set(entries.map((e) => e.user_id))];
        if (targetIds.includes(req.user.id)) {
          return reply.status(400).send({
            error: 'You cannot mark your own attendance',
          });
        }
        const allowedIds = await repo.listHierarchySubordinates(
          req.user.id,
          targetIds
        );
        const unauthorized = targetIds.filter((id) => !allowedIds.has(id));
        if (unauthorized.length > 0) {
          return reply.status(403).send({
            error: 'Some selected members are not in your hierarchy',
            unauthorized,
          });
        }
      }

      const results = await repo.bulkMark(entries, req.user.id);
      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'ATTENDANCE_BULK_MARKED',
        resourceType: 'attendance',
        details: { count: results.length, date: entries[0]?.date },
      };
      for (const e of entries)
        await sendNotification(
          e.user_id,
          `Your attendance for ${e.date} has been marked as ${e.status}.`
        );
      return { success: true, count: results.length, records: results };
    }
  );

  // Get attendance for a user (with ownership check)
  fastify.get(
    '/:userId',
    {
      schema: { tags: ['Attendance'], description: 'Get attendance records' },
      preHandler: [auth, ownership('userId')],
    },
    async (req) => {
      const { from, to, page, limit } = req.query;
      return repo.getAttendance(req.params.userId, { from, to, page, limit });
    }
  );

  // Monthly stats (requires ownership)
  fastify.get(
    '/:userId/stats',
    {
      schema: {
        tags: ['Attendance'],
        description: 'Get monthly attendance stats',
      },
      preHandler: [auth, ownership('userId')],
    },
    async (req, reply) => {
      const schema = z.object({
        month: z.coerce.number().int().min(1).max(12),
        year: z.coerce.number().int().min(1970).max(3000),
      });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'month and year are required',
          details: parsed.error.issues,
        });
      }
      const { month, year } = parsed.data;
      return repo.getMonthlyStats(req.params.userId, month, year);
    }
  );

  //Authorized members
  fastify.get(
    '/authorized-members',
    {
      schema: { tags: ['Attendance'], description: 'Get members I can view' },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
    },
    async (req) => {
      if (req.user.role === 'ADMIN') {
        const all = await pool.query(
          'SELECT id, full_name, role FROM users WHERE deleted_at IS NULL'
        );
        return all.rows;
      }
      return await repo.getAuthorizedSubordinates(req.user.id);
    }
  );
}

module.exports = routes;
