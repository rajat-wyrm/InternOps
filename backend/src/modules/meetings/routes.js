const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');

async function routes(fastify) {
  // List meetings (hierarchy-aware)
  fastify.get('/', { preHandler: [auth] }, async (req) => {
    const { from, to } = req.query;
    const pool = require('../../config/db');
    const deptRes = await pool.query(
      'SELECT department_id FROM users WHERE id=$1',
      [req.user.id]
    );
    const departmentId = deptRes.rows[0]?.department_id || null;
    return repo.listMeetings({
      userId: req.user.id,
      departmentId: req.user.role !== 'INTERN' ? departmentId : null,
      fromDate: from,
      toDate: to,
    });
  });

  // Get single meeting
  fastify.get('/:id', { preHandler: [auth] }, async (req, reply) => {
    const meeting = await repo.getMeetingById(req.params.id);
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });

    // Fetch attendees first — used for both isAttendee and isManager below.
    // This replaces the inline raw pool.query() that was checking attendance
    // separately and eliminates the second repo.getAttendees() call that was
    // previously below the access gate.
    const attendees = await repo.getAttendees(meeting.id);

    const isCreator = meeting.created_by === req.user.id;

    //  Derived from the already-fetched attendees list — no extra DB call.
    const isAttendee = attendees.some((a) => a.id === req.user.id);

    //  isManager now checks hierarchy against attendees — not the creator.
    // Access is granted only if the requester directly manages at least one
    // participant of this specific meeting. This prevents a manager of the
    // creator from gaining access to meetings they have no connection to.
    const isManager =
      req.user.role !== 'INTERN' &&
      attendees.filter((a) => a.id !== req.user.id).length > 0 &&
      (
        await Promise.all(
          attendees
            .filter((a) => a.id !== req.user.id)
            .map((a) => checkHierarchyAccess(req.user.id, a.id))
        )
      ).some(Boolean);

    if (!isCreator && !isAttendee && !isManager && req.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Access denied' });
    }

    //  Reuse already-fetched attendees in response — no second DB round-trip.
    return { ...meeting, attendees };
  });

  // Create meeting
  fastify.post(
    '/',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')] },
    async (req, reply) => {
      const schema = z.object({
        title: z.string().min(3),
        description: z.string().optional(),
        meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        departmentId: z.string().uuid().optional(),
        attendeeIds: z.array(z.string().uuid()).optional(),
      });
      const validation = schema.safeParse(req.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const meeting = await repo.createMeeting({
        ...data,
        createdBy: req.user.id,
      });
      const skippedAttendees = [];
      if (data.attendeeIds) {
        for (const uid of data.attendeeIds) {
          if (req.user.role !== 'ADMIN') {
            const allowed = await checkHierarchyAccess(req.user.id, uid);
            if (!allowed) {
              skippedAttendees.push({
                userId: uid,
                reason: 'Not in your hierarchy',
              });
              continue;
            }
          }
          await repo.addAttendee(meeting.id, uid);
        }
      }
      const attendees = await repo.getAttendees(meeting.id);
      await createAuditLog({
        userId: req.user.id,
        action: 'MEETING_CREATED',
        resourceType: 'meeting',
        resourceId: meeting.id,
        ...extractRequestInfo(req),
      });
      return reply.status(201).send({
        ...meeting,
        attendees,
        skippedAttendees,
      });
    }
  );

  // Update meeting
  fastify.patch(
    '/:id',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')] },
    async (req, reply) => {
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting) return reply.status(404).send({ error: 'Not found' });
      if (meeting.created_by !== req.user.id && req.user.role !== 'ADMIN') {
        return reply
          .status(403)
          .send({ error: 'Only creator or admin can update' });
      }
      const updated = await repo.updateMeeting(req.params.id, req.body);
      return updated;
    }
  );

  // Delete meeting (soft)
  fastify.delete(
    '/:id',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')] },
    async (req, reply) => {
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting) return reply.status(404).send({ error: 'Not found' });
      if (meeting.created_by !== req.user.id && req.user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Only creator or admin' });
      }
      await repo.softDeleteMeeting(req.params.id);
      await createAuditLog({
        userId: req.user.id,
        action: 'MEETING_DELETED',
        resourceType: 'meeting',
        resourceId: meeting.id,
        ...extractRequestInfo(req),
      });
      return { message: 'Meeting deleted' };
    }
  );

  // Add attendee
  fastify.post(
    '/:id/attendees',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')] },
    async (req, reply) => {
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting) return reply.status(404).send({ error: 'Not found' });
      const { userId } = req.body;
      if (meeting.created_by !== req.user.id && req.user.role !== 'ADMIN') {
        return reply
          .status(403)
          .send({ error: 'Only creator can add attendees' });
      }
      await repo.addAttendee(req.params.id, userId);
      return { message: 'Attendee added' };
    }
  );

  // Remove attendee
  fastify.delete(
    '/:id/attendees/:userId',
    { preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')] },
    async (req, reply) => {
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting) return reply.status(404).send({ error: 'Not found' });
      if (meeting.created_by !== req.user.id && req.user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Only creator or admin' });
      }
      await repo.removeAttendee(req.params.id, req.params.userId);
      return { message: 'Attendee removed' };
    }
  );
}

module.exports = routes;
