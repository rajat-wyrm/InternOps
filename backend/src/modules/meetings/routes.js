const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const { extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');

function formatMeeting(m) {
  if (!m) return null;
  const dateStr = m.meeting_date
    ? m.meeting_date instanceof Date
      ? `${m.meeting_date.getFullYear()}-${String(m.meeting_date.getMonth() + 1).padStart(2, '0')}-${String(m.meeting_date.getDate()).padStart(2, '0')}`
      : String(m.meeting_date).split('T')[0]
    : undefined;
  return {
    ...m,
    meeting_date: dateStr,
    meetingDate: dateStr,
    meetingUrl: m.meeting_url,
    startTime: m.start_time,
    endTime: m.end_time,
    departmentId: m.department_id,
    createdBy: m.created_by,
  };
}

const createMeetingBody = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  meetingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  meeting_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  meetingUrl: z.string().url().optional(),
  meeting_url: z.string().url().optional(),
  startTime: z.string().optional(),
  start_time: z.string().optional(),
  endTime: z.string().optional(),
  end_time: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  attendeeIds: z.array(z.string().uuid()).optional(),
  attendee_ids: z.array(z.string().uuid()).optional(),
});

const updateMeetingBody = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  meetingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  meeting_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  meetingUrl: z.string().url().optional(),
  meeting_url: z.string().url().optional(),
  startTime: z.string().optional(),
  start_time: z.string().optional(),
  endTime: z.string().optional(),
  end_time: z.string().optional(),
});

async function routes(fastify) {
  // List meetings (hierarchy-aware)
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Meetings'],
        description: 'List meetings',
        querystring: toSchema(
          z.object({ from: z.string().optional(), to: z.string().optional() })
        ),
      },
      preHandler: [auth],
    },
    async (req) => {
      const { from, to } = req.query;
      const departmentId = await repo.getUserDepartmentId(req.user.id);
      const result = await repo.listMeetings({
        userId: req.user.id,
        departmentId: req.user.role !== 'INTERN' ? departmentId : null,
        fromDate: from,
        toDate: to,
      });
      return {
        ...result,
        data: result.data.map(formatMeeting),
      };
    }
  );

  // Get single meeting
  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Meetings'],
        description: 'Get a meeting by ID',
        params: toSchema(z.object({ id: z.string().uuid() })),
      },
      preHandler: [auth],
    },
    async (req, reply) => {
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting)
        return reply.status(404).send({ error: 'Meeting not found' });

      const attendees = await repo.getAttendees(meeting.id);
      const isCreator = meeting.created_by === req.user.id;
      const isAttendee = attendees.some((a) => a.id === req.user.id);
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

      if (
        !isCreator &&
        !isAttendee &&
        !isManager &&
        req.user.role !== 'ADMIN'
      ) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      return { ...formatMeeting(meeting), attendees };
    }
  );

  // Create meeting
  fastify.post(
    '/',
    {
      schema: {
        tags: ['Meetings'],
        description: 'Create a meeting',
        body: toSchema(createMeetingBody),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL'), sanitize],
    },
    async (req, reply) => {
      const schema = createMeetingBody.refine(
        (d) => d.meetingDate || d.meeting_date,
        {
          message: 'meetingDate or meeting_date is required',
          path: ['meetingDate'],
        }
      );

      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const meetingDate = data.meetingDate || data.meeting_date;
      const meetingUrl = data.meetingUrl || data.meeting_url;
      const startTime = data.startTime || data.start_time;
      const endTime = data.endTime || data.end_time;
      const departmentId = data.departmentId || data.department_id;
      const attendeeIds = data.attendeeIds || data.attendee_ids || [];

      const meeting = await repo.createMeeting({
        title: data.title,
        description: data.description,
        meetingDate,
        meetingUrl,
        startTime,
        endTime,
        departmentId,
        createdBy: req.user.id,
      });

      const skippedAttendees = [];
      for (const uid of attendeeIds) {
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

      const attendees = await repo.getAttendees(meeting.id);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'MEETING_CREATED',
        resourceType: 'meeting',
        resourceId: meeting.id,
        ...extractRequestInfo(req),
      };

      return reply.status(201).send({
        ...formatMeeting(meeting),
        attendees,
        skippedAttendees,
      });
    }
  );

  // Update meeting
  fastify.patch(
    '/:id',
    {
      schema: {
        tags: ['Meetings'],
        description: 'Update a meeting',
        params: toSchema(z.object({ id: z.string().uuid() })),
        body: toSchema(updateMeetingBody),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL'), sanitize],
    },
    async (req, reply) => {
      const schema = updateMeetingBody.strict();

      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting) return reply.status(404).send({ error: 'Not found' });
      if (meeting.created_by !== req.user.id && req.user.role !== 'ADMIN') {
        return reply
          .status(403)
          .send({ error: 'Only creator or admin can update' });
      }

      const normalized = {};
      if (data.title !== undefined) normalized.title = data.title;
      if (data.description !== undefined)
        normalized.description = data.description;
      const mUrl = data.meeting_url || data.meetingUrl;
      if (mUrl !== undefined) normalized.meeting_url = mUrl;
      const mDate = data.meeting_date || data.meetingDate;
      if (mDate !== undefined) normalized.meeting_date = mDate;
      const sTime = data.start_time || data.startTime;
      if (sTime !== undefined) normalized.start_time = sTime;
      const eTime = data.end_time || data.endTime;
      if (eTime !== undefined) normalized.end_time = eTime;

      const updated = await repo.updateMeeting(req.params.id, normalized);
      if (!updated)
        return reply.status(400).send({ error: 'No valid fields provided' });
      return formatMeeting(updated);
    }
  );

  // Delete meeting (soft)
  fastify.delete(
    '/:id',
    {
      schema: {
        tags: ['Meetings'],
        description: 'Delete a meeting',
        params: toSchema(z.object({ id: z.string().uuid() })),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')],
    },
    async (req, reply) => {
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting) return reply.status(404).send({ error: 'Not found' });
      if (meeting.created_by !== req.user.id && req.user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Only creator or admin' });
      }
      await repo.softDeleteMeeting(req.params.id);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'MEETING_DELETED',
        resourceType: 'meeting',
        resourceId: meeting.id,
        ...extractRequestInfo(req),
      };
      return { message: 'Meeting deleted' };
    }
  );

  // Add attendee
  fastify.post(
    '/:id/attendees',
    {
      schema: {
        tags: ['Meetings'],
        description: 'Add attendee to meeting',
        params: toSchema(z.object({ id: z.string().uuid() })),
        body: toSchema(z.object({ userId: z.string().uuid() })),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'), sanitize],
    },
    async (req, reply) => {
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting) return reply.status(404).send({ error: 'Not found' });
      const { userId } = req.body;
      if (!userId || typeof userId !== 'string') {
        return reply.status(400).send({ error: 'userId is required' });
      }

      let allowed =
        meeting.created_by === req.user.id || req.user.role === 'ADMIN';
      if (!allowed) {
        allowed = await checkHierarchyAccess(req.user.id, userId);
      }
      if (!allowed) {
        return reply.status(403).send({
          error:
            'Only creator, admin, or manager of the attendee can add attendees',
        });
      }

      // Validate that the target user exists and is not suspended/deleted.
      const exists = await repo.userExists(userId);
      if (!exists) {
        return reply
          .status(404)
          .send({ error: 'Target user not found or inactive' });
      }

      await repo.addAttendee(req.params.id, userId);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'MEETING_ATTENDEE_ADDED',
        resourceType: 'meeting',
        resourceId: req.params.id,
        details: { addedUserId: userId },
        ...extractRequestInfo(req),
      };
      return { message: 'Attendee added' };
    }
  );

  // Remove attendee
  fastify.delete(
    '/:id/attendees/:userId',
    {
      schema: {
        tags: ['Meetings'],
        description: 'Remove attendee from meeting',
        params: toSchema(
          z.object({ id: z.string().uuid(), userId: z.string().uuid() })
        ),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')],
    },
    async (req, reply) => {
      const meeting = await repo.getMeetingById(req.params.id);
      if (!meeting) return reply.status(404).send({ error: 'Not found' });

      let allowed =
        meeting.created_by === req.user.id || req.user.role === 'ADMIN';
      if (!allowed) {
        allowed = await checkHierarchyAccess(req.user.id, req.params.userId);
      }
      if (!allowed) {
        return reply.status(403).send({
          error:
            'Only creator, admin, or manager of the attendee can remove attendees',
        });
      }

      await repo.removeAttendee(req.params.id, req.params.userId);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'MEETING_ATTENDEE_REMOVED',
        resourceType: 'meeting',
        resourceId: req.params.id,
        details: { removedUserId: req.params.userId },
        ...extractRequestInfo(req),
      };
      return { message: 'Attendee removed' };
    }
  );
}

module.exports = routes;
