const auth = require('../../middleware/auth');
const direct = require('../../middleware/directManager');
const ownership = require('../../middleware/ownership');
const rbac = require('../../middleware/rbac');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { send: sendNotification } = require('../notifications/repository');

async function routes(fastify) {
  // Mark attendance (manager roles; target must be in the requester's hierarchy)
  fastify.post('/mark', { schema: { tags: ['Attendance'], description: 'Mark single attendance' }, preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')] }, async (req, reply) => {
    const { user_id, date, status, remarks } = req.body;
    if (!user_id || !date || !status) return reply.status(400).send({ error: 'user_id, date and status are required' });
    if (req.user.role !== 'ADMIN') {
      const ok = await checkHierarchyAccess(req.user.id, user_id);
      if (!ok) return reply.status(403).send({ error: 'This member is not in your team' });
    }
    const att = await repo.markAttendance(user_id, req.user.id, date, status, remarks);
    await createAuditLog({
      userId: req.user.id,
      ...extractRequestInfo(req), action: 'ATTENDANCE_MARKED',
      resourceType: 'attendance',
      resourceId: att.id,
      details: { target: user_id, date, status, remarks },
    });
    await sendNotification(user_id, `Your attendance for ${date} has been marked as ${status}.`);
  });

  // Bulk mark attendance (manager roles, ownership validated per entry)
  fastify.post('/bulk', { schema: { tags: ['Attendance'], description: 'Bulk mark attendance' }, preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')] }, async (req, reply) => {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (entries.length === 0) return reply.status(400).send({ error: 'No entries provided' });

    // Every target must be inside the requester's hierarchy.
    for (const e of entries) {
      if (!e.user_id || !e.date || !e.status) return reply.status(400).send({ error: 'Each entry needs user_id, date and status' });
      if (req.user.role !== 'ADMIN') {
        const ok = await checkHierarchyAccess(req.user.id, e.user_id);
        if (!ok) return reply.status(403).send({ error: 'A selected member is not in your hierarchy' });
      }
    }

    const results = await repo.bulkMark(entries, req.user.id);
    await createAuditLog({
      userId: req.user.id,
      ...extractRequestInfo(req), action: 'ATTENDANCE_BULK_MARKED',
      resourceType: 'attendance',
      details: { count: results.length, date: entries[0]?.date },
    });
    for (const e of entries) await sendNotification(e.user_id, `Your attendance for ${e.date} has been marked as ${e.status}.`);
    return { success: true, count: results.length, records: results };
  });

  // Bulk mark attendance (requires auth, enforces direct manager validation per subordinate)
  fastify.post('/bulk', { schema: { tags: ['Attendance'], description: 'Bulk mark attendance' }, preHandler: [auth] }, async (req) => {
    const { z } = require('zod');
    const schema = z.object({
      entries: z.array(z.object({
        user_id: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(['PRESENT','ABSENT','HALF_DAY']),
        remarks: z.string().optional()
      }))
    });
    const { entries } = schema.parse(req.body);
    const results = [];
    const pool = require('../../config/db');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const entry of entries) {
        // Enforce direct manager check
        const { rows: [user] } = await client.query('SELECT role, manager_id FROM users WHERE id = $1', [entry.user_id]);
        if (!user || user.manager_id !== req.user.id || !require('../../utils/hierarchy').isValidStep(req.user.role, user.role)) {
          throw new Error(`Unauthorized to mark attendance for user ${entry.user_id}`);
        }
        
        const res = await client.query(
          `INSERT INTO attendance (user_id, marked_by, date, status, remarks)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (user_id, date)
           DO UPDATE SET status=$4, marked_by=$2, remarks=$5, updated_at=NOW()
           RETURNING *`,
          [entry.user_id, req.user.id, entry.date, entry.status, entry.remarks || null]
        );
        const att = res.rows[0];
        results.push(att);
        
        await createAuditLog({
          userId: req.user.id,
          ...extractRequestInfo(req),
          action: 'ATTENDANCE_MARKED',
          resourceType: 'attendance',
          resourceId: att.id,
          details: { target: entry.user_id, date: entry.date, status: entry.status, remarks: entry.remarks }
        });
        
        await sendNotification(entry.user_id, `Your attendance for ${entry.date} has been marked as ${entry.status}.`);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return results;
  });

  // Get attendance for a user (with ownership check)
  fastify.get('/:userId', { schema: { tags: ['Attendance'], description: 'Get attendance records' }, preHandler: [auth, ownership('userId')] }, async (req) => {
    const { from, to } = req.query;
    return repo.getAttendance(req.params.userId, from, to);
  });

  // Monthly stats (requires ownership)
  fastify.get('/:userId/stats', { schema: { tags: ['Attendance'], description: 'Get monthly attendance stats' }, preHandler: [auth, ownership('userId')] }, async (req) => {
    const { month, year } = req.query;
    if (!month || !year) throw new Error('month and year required');
    return repo.getMonthlyStats(req.params.userId, month, year);
  });
}

module.exports = routes;




