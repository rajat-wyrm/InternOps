const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const { notifyUser } = require('../../websocket');
const auth = require('../../middleware/auth');
const ownership = require('../../middleware/ownership');
const rbac = require('../../middleware/rbac');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { dbTx } = require('../../utils/dbTx');
const {
  send: sendNotification,
  getUnreadCount,
} = require('../notifications/repository');
const pool = require('../../config/db');
const { z } = require('zod');

async function routes(fastify) {
  // Mark attendance (manager roles; target must be in the requester's hierarchy)
  fastify.post(
    '/mark',
    {
      schema: { tags: ['Attendance'], description: 'Mark single attendance' },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'), sanitize],
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

        if (!ok) {
          return reply
            .status(403)
            .send({ error: 'This member is not in your team' });
        }
      }

      const { attendance, notification } = await dbTx(async (client) => {
        const att = await repo.markAttendance(
          user_id,
          req.user.id,
          date,
          status,
          remarks,
          client
        );

        await createAuditLog(
          {
            userId: req.user.id,
            ...extractRequestInfo(req),
            action: 'ATTENDANCE_MARKED',
            resourceType: 'attendance',
            resourceId: att.id,
            details: { target: user_id, date, status, remarks },
          },
          client
        );

        const createdNotification = await sendNotification(
          user_id,
          `Your attendance for ${date} has been marked as ${status}.`,
          client,
          { emit: false }
        );

        return {
          attendance: att,
          notification: createdNotification,
        };
      });

      const unreadCount = await getUnreadCount(user_id);

      await notifyUser(user_id, 'notification-received', {
        notification,
        unreadCount,
      });

      await notifyUser(attendance.user_id, 'attendance-marked', {
        attendance,
      });

      return reply.status(201).send(attendance);
    }
  );

  // Bulk mark attendance (manager roles, ownership validated per entry)
  fastify.post(
    '/bulk',
    {
      schema: { tags: ['Attendance'], description: 'Bulk mark attendance' },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'), sanitize],
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

      const { results, notifications } = await dbTx(async (client) => {
        const records = await repo.bulkMark(entries, req.user.id, client);

        await createAuditLog(
          {
            userId: req.user.id,
            ...extractRequestInfo(req),
            action: 'ATTENDANCE_BULK_MARKED',
            resourceType: 'attendance',
            details: { count: records.length, date: entries[0]?.date },
          },
          client
        );

        const createdNotifications = [];

        for (const e of entries) {
          const notification = await sendNotification(
            e.user_id,
            `Your attendance for ${e.date} has been marked as ${e.status}.`,
            client,
            { emit: false }
          );

          createdNotifications.push(notification);
        }

        return {
          results: records,
          notifications: createdNotifications,
        };
      });

      for (const notification of notifications) {
        const unreadCount = await getUnreadCount(notification.user_id);

        await notifyUser(notification.user_id, 'notification-received', {
          notification,
          unreadCount,
        });
      }

      for (const attendance of results) {
        await notifyUser(attendance.user_id, 'attendance-marked', {
          attendance,
        });
      }

      return {
        success: true,
        count: results.length,
        records: results,
      };
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

  // Authorized members
  fastify.get(
    '/authorized-members',
    {
      schema: { tags: ['Attendance'], description: 'Get members I can view' },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
    },
    async (req) => {
      if (req.user.role === 'ADMIN') {
        const all = await pool.query(
          'SELECT id, full_name, email, role FROM users WHERE deleted_at IS NULL'
        );
        return all.rows;
      }
      return await repo.getAuthorizedSubordinates(req.user.id);
    }
  );
}

module.exports = routes;
