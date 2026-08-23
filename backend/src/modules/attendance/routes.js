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
  bulkSend,
  getUnreadCount,
} = require('../notifications/repository');
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
      try {
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
      } catch (err) {
        req.log.error(err, 'Error in POST /attendance/mark');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Bulk mark attendance (manager roles, ownership validated per entry)
  fastify.post(
    '/bulk',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { tags: ['Attendance'], description: 'Bulk mark attendance' },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'), sanitize],
    },
    async (req, reply) => {
      try {
        const entrySchema = z.object({
          user_id: z.string().uuid(),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
          status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY']),
          remarks: z.string().max(500).optional(),
        });
        const bodySchema = z.object({
          entries: z.array(entrySchema).min(1),
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

        const { results } = await dbTx(async (client) => {
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

          return {
            results: records,
          };
        });

        const notificationsData = entries.map((e) => ({
          user_id: e.user_id,
          message: `Your attendance for ${e.date} has been marked as ${e.status}.`,
        }));

        const notifications = await bulkSend(notificationsData);

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
      } catch (err) {
        req.log.error(err, 'Error in POST /attendance/bulk');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Department-scoped attendance sheet
  fastify.get(
    '/department/:deptId/sheet',
    {
      schema: {
        tags: ['Attendance'],
        description: 'Get a department attendance sheet',
      },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
    },
    async (req, reply) => {
      try {
        const paramsSchema = z.object({ deptId: z.string().uuid() });
        const querySchema = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .refine((value) => value.from <= value.to, {
            message: 'from must be on or before to',
          })
          .refine(
            (value) => {
              const from = new Date(`${value.from}T00:00:00Z`);
              const to = new Date(`${value.to}T00:00:00Z`);
              return (to - from) / 86400000 <= 62;
            },
            { message: 'Date range cannot exceed 62 days' }
          );

        const parsedParams = paramsSchema.safeParse(req.params);
        const parsedQuery = querySchema.safeParse(req.query);
        if (!parsedParams.success || !parsedQuery.success) {
          return reply.status(400).send({
            error: 'Invalid attendance sheet request',
            details: [
              ...(parsedParams.success ? [] : parsedParams.error.issues),
              ...(parsedQuery.success ? [] : parsedQuery.error.issues),
            ],
          });
        }

        return await repo.getDepartmentAttendanceSheet({
          departmentId: parsedParams.data.deptId,
          requesterId: req.user.id,
          isAdmin: req.user.role === 'ADMIN',
          from: parsedQuery.data.from,
          to: parsedQuery.data.to,
        });
      } catch (err) {
        req.log.error(err, 'Error in GET /attendance/department/:deptId/sheet');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Get attendance for a user (with ownership check)
  fastify.get(
    '/:userId',
    {
      schema: { tags: ['Attendance'], description: 'Get attendance records' },
      preHandler: [auth, ownership('userId')],
    },
    async (req, reply) => {
      try {
        const { from, to, page, limit } = req.query;
        return await repo.getAttendance(req.params.userId, {
          from,
          to,
          page,
          limit,
        });
      } catch (err) {
        req.log.error(err, 'Error in GET /attendance/:userId');
        return reply.status(500).send({ error: 'Internal server error' });
      }
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
      try {
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
        return await repo.getMonthlyStats(req.params.userId, month, year);
      } catch (err) {
        req.log.error(err, 'Error in GET /attendance/:userId/stats');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // Authorized members
  fastify.get(
    '/authorized-members',
    {
      schema: { tags: ['Attendance'], description: 'Get members I can view' },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')],
    },
    async (req, reply) => {
      try {
        if (req.user.role === 'ADMIN') {
          const departmentId = req.query?.department_id;

          if (departmentId) {
            return await repo.getUsersByDepartment(departmentId);
          }

          return await repo.getAllUsers();
        }
        return await repo.getAuthorizedSubordinates(req.user.id);
      } catch (err) {
        req.log.error(err, 'Error in GET /attendance/authorized-members');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // GET /anomalies - Retrieve anomalies for a manager
  fastify.get(
    '/anomalies',
    {
      schema: {
        tags: ['Attendance'],
        description: 'Get attendance anomaly flags for team members',
      },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'), sanitize],
    },
    async (req, reply) => {
      try {
        const schema = z.object({
          intern_id: z.string().uuid().optional(),
          flag_type: z.string().optional(),
          viewed: z
            .string()
            .optional()
            .transform((val) => {
              if (val === 'true') return true;
              if (val === 'false') return false;
              return undefined;
            }),
        });

        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
        }

        const isAdmin = req.user.role === 'ADMIN';
        const anomalies = await repo.getAnomalies(
          req.user.id,
          isAdmin,
          parsed.data
        );
        return anomalies;
      } catch (err) {
        req.log.error(err, 'Error in GET /attendance/anomalies');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // POST /anomalies/:id/view - Mark anomaly as viewed by a manager
  fastify.post(
    '/anomalies/:id/view',
    {
      schema: {
        tags: ['Attendance'],
        description: 'Mark an attendance anomaly flag as viewed',
      },
      preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'), sanitize],
    },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'ADMIN';

        // Mark viewed and retrieve updated record
        const anomaly = await repo.markAnomalyViewed(id, req.user.id, isAdmin);

        // Log audit log event using audit repository
        const audit = require('../audit/repository');
        if (audit && typeof audit.logEvent === 'function') {
          await audit.logEvent({
            userId: req.user.id,
            action: 'ATTENDANCE_ANOMALY_VIEWED',
            resourceType: 'attendance_anomaly',
            resourceId: id,
            details: {
              intern_id: anomaly.intern_id,
              flag_type: anomaly.flag_type,
              reason: anomaly.reason,
            },
          });
        }

        return anomaly;
      } catch (err) {
        req.log.error(err, 'Error in POST /attendance/anomalies/:id/view');
        if (
          err.message.includes('Access denied') ||
          err.message.includes('not in your hierarchy')
        ) {
          return reply.status(403).send({ error: err.message });
        }
        if (err.message.includes('not found')) {
          return reply.status(404).send({ error: err.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  // POST /anomalies/analyze - Manually trigger AI analysis job on FastAPI
  fastify.post(
    '/anomalies/analyze',
    {
      schema: {
        tags: ['Attendance'],
        description: 'Trigger AI attendance anomaly analysis',
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL'), sanitize],
    },
    async (req, reply) => {
      try {
        const config = require('../../config');
        const { generateAccessToken } = require('../../utils/tokens');

        const baseUrl = config.ai.fastapiUrl || 'http://localhost:8000';
        const serviceToken = generateAccessToken({
          id: req.user.id,
          role: req.user.role,
          department_id: req.user.department_id,
        });

        const response = await fetch(
          `${baseUrl}/api/v1/attendance/anomalies/analyze`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`FastAPI service returned status ${response.status}`);
        }

        const data = await response.json();
        return reply.status(202).send(data);
      } catch (err) {
        req.log.error(err, 'Error in POST /attendance/anomalies/analyze');
        return reply.status(503).send({ error: 'AI service unavailable' });
      }
    }
  );
}

module.exports = routes;
