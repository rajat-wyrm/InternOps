const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const ownership = require('../../middleware/ownership');
const requireFreshRole = require('../../middleware/requireFreshRole');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { toSchema } = require('../../utils/schemaHelper');
const { checkHierarchyAccess, ROLE_RANK } = require('../../utils/hierarchy');
const { z } = require('zod');

// Roles that manage a team (Interns have no reports).
const MANAGER_ROLES = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'];
// Roles a manager can assign (ADMIN is never assignable through team mgmt).
const ASSIGNABLE_ROLES = ['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'];

const detailFields = {
  full_name: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  college: z.string().max(255).optional(),
  course: z.string().max(255).optional(),
  year_of_study: z.string().max(50).optional(),
  position: z.string().max(255).optional(),
  joining_date: z.string().max(20).optional(),
  internship_status: z
    .enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'TERMINATED'])
    .optional(),
  location: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
};

const updateSchema = z.object(detailFields);
const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN']),
  manager_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  ...detailFields,
});

const toggleStatusSchema = z.object({
  suspended: z.boolean(),
});

const changeRoleSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES),
});

const changeManagerSchema = z.object({
  manager_id: z.string().uuid(),
});

function toCsv(rows) {
  const cols = [
    'full_name',
    'email',
    'role',
    'department_name',
    'phone',
    'location',
    'college',
    'course',
    'position',
    'joining_date',
    'internship_status',
  ];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

async function routes(fastify) {
  // List everyone in the requester's team, with details + performance summary.
  fastify.get(
    '/members',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES)],
      schema: {
        tags: ['Team'],
        description: 'List team members',
        querystring: {
          type: 'object',
          properties: {
            department_id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req) => {
      return repo.getTeamMembers(req.user.id, req.query?.department_id);
    }
  );

  // Export the requester's team as CSV.
  fastify.get(
    '/members/export',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES)],
      schema: { tags: ['Team'], description: 'Export team members as CSV' },
    },
    async (req, reply) => {
      const members = await repo.getTeamMembers(req.user.id);
      reply.header('Content-Type', 'text/csv');
      reply.header(
        'Content-Disposition',
        'attachment; filename="team-members.csv"'
      );
      return toCsv(members);
    }
  );

  // Recent proofs across the requester's team that are awaiting verification.
  fastify.get(
    '/pending-proofs',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES)],
      schema: { tags: ['Team'], description: 'Get pending proofs for team' },
    },
    async (req) => {
      return repo.getPendingProofs(req.user.id);
    }
  );

  // Add a new member under the requester (or a sub-manager in their team).
  fastify.post(
    '/members',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES), sanitize],
      schema: {
        tags: ['Team'],
        description: 'Create new team member',
        body: {
          type: 'object',
          required: ['email', 'password', 'role'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            role: {
              type: 'string',
              enum: ['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'],
            },
            manager_id: { type: 'string', format: 'uuid' },
            department_id: { type: 'string', format: 'uuid' },
            full_name: { type: 'string', maxLength: 255 },
            phone: { type: 'string', maxLength: 20 },
            college: { type: 'string', maxLength: 255 },
            course: { type: 'string', maxLength: 255 },
            year_of_study: { type: 'string', maxLength: 50 },
            position: { type: 'string', maxLength: 255 },
            joining_date: { type: 'string', maxLength: 20 },
            internship_status: {
              type: 'string',
              enum: ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'TERMINATED'],
            },
            location: { type: 'string', maxLength: 255 },
            notes: { type: 'string', maxLength: 2000 },
          },
        },
      },
    },
    async (req, reply) => {
      const data = createSchema.parse(req.body);

      // Default the manager to the requester; otherwise it must be inside their team.
      const managerId = data.manager_id || req.user.id;
      if (managerId !== req.user.id && req.user.role !== 'ADMIN') {
        const inTeam = await checkHierarchyAccess(req.user.id, managerId);
        if (!inTeam)
          return reply
            .status(403)
            .send({ error: 'Chosen manager is not in your team' });
      }
      const managerRole =
        managerId === req.user.id
          ? req.user.role
          : await repo.getUserRole(managerId);
      if (!managerRole)
        return reply.status(400).send({ error: 'Manager not found' });
      if (
        ROLE_RANK[data.role] === undefined ||
        ROLE_RANK[data.role] >= ROLE_RANK[managerRole]
      ) {
        return reply.status(400).send({
          error: `You can only add members below your own role (${managerRole})`,
        });
      }
      if (await repo.emailExists(data.email)) {
        return reply
          .status(409)
          .send({ error: 'A user with this email already exists' });
      }

      const member = await repo.createMember({
        ...data,
        manager_id: managerId,
      });
      await createAuditLog({
        userId: req.user.id,
        action: 'MEMBER_CREATED',
        resourceType: 'user',
        resourceId: member.id,
        newValue: { email: member.email, role: member.role },
        ...extractRequestInfo(req),
      });
      return reply.status(201).send(member);
    }
  );

  // Single member's full detail (must be inside the requester's hierarchy).
  fastify.get(
    '/members/:id',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES), ownership('id')],
      schema: {
        tags: ['Team'],
        description: 'Get team member by ID',
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const member = await repo.getMemberById(req.params.id);
      return member || reply.status(404).send({ error: 'Member not found' });
    }
  );

  // Attendance + ratings history for a member.
  fastify.get(
    '/members/:id/history',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES), ownership('id')],
      schema: {
        tags: ['Team'],
        description: 'Get member history',
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (req) => {
      return repo.getMemberHistory(req.params.id);
    }
  );

  // Update a member's detail fields (within hierarchy), with audit trail.
  fastify.patch(
    '/members/:id',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES), ownership('id'), sanitize],
      schema: {
        tags: ['Team'],
        description: 'Update team member details',
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const data = updateSchema.parse(req.body);
      const before = await repo.getMemberById(req.params.id);
      if (!before) return reply.status(404).send({ error: 'Member not found' });
      const after = await repo.updateMember(req.params.id, data);
      await createAuditLog({
        userId: req.user.id,
        action: 'MEMBER_DETAILS_UPDATED',
        resourceType: 'user',
        resourceId: req.params.id,
        oldValue: before,
        newValue: after,
        ...extractRequestInfo(req),
      });
      return after;
    }
  );

  // Suspend / activate a member (within hierarchy).
  fastify.patch(
    '/members/:id/status',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES), ownership('id'), sanitize],
      schema: {
        tags: ['Team'],
        description: 'Toggle member suspension',
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: toSchema(toggleStatusSchema),
      },
    },
    async (req, reply) => {
      const { suspended } = z
        .object({ suspended: z.boolean() })
        .parse(req.body);
      const member = await repo.setMemberStatus(req.params.id, suspended);
      if (!member) return reply.status(404).send({ error: 'Member not found' });
      await createAuditLog({
        userId: req.user.id,
        action: suspended ? 'MEMBER_SUSPENDED' : 'MEMBER_ACTIVATED',
        resourceType: 'user',
        resourceId: req.params.id,
        ...extractRequestInfo(req),
      });
      return member;
    }
  );

  // Promote / demote a member's role (within hierarchy).
  fastify.patch(
    '/members/:id/role',
    {
      preHandler: [
        auth,
        rbac(...MANAGER_ROLES),
        requireFreshRole,
        ownership('id'),
        sanitize,
      ],
      schema: {
        tags: ['Team'],
        description: 'Change member role',
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: toSchema(changeRoleSchema),
      },
    },
    async (req, reply) => {
      const { role } = z
        .object({ role: z.enum(ASSIGNABLE_ROLES) })
        .parse(req.body);

      // A manager may never change their own role here.
      if (req.params.id === req.user.id) {
        return reply
          .status(403)
          .send({ error: 'You cannot change your own role' });
      }

      // New role must be strictly below the requester's own rank.
      if (
        req.user.role !== 'ADMIN' &&
        ROLE_RANK[role] >= ROLE_RANK[req.user.role]
      ) {
        return reply.status(403).send({
          error: `You can only assign roles below your own (${req.user.role})`,
        });
      }

      const before = await repo.getMemberById(req.params.id);
      if (!before) return reply.status(404).send({ error: 'Member not found' });

      // Demotion must not leave the member ranked at/below their own reports.
      const reportRoles = await repo.getDirectReportRoles(req.params.id);
      const highestReport = reportRoles.reduce(
        (max, r) => Math.max(max, ROLE_RANK[r] ?? 0),
        -1
      );
      if (highestReport >= ROLE_RANK[role]) {
        return reply.status(400).send({
          error:
            'New role would not outrank this member’s existing reports. Reassign their reports first.',
        });
      }

      try {
        const after = await repo.updateMemberRole(req.params.id, role);
        await createAuditLog({
          userId: req.user.id,
          action: 'MEMBER_ROLE_CHANGED',
          resourceType: 'user',
          resourceId: req.params.id,
          oldValue: { role: before.role },
          newValue: { role: after.role },
          ...extractRequestInfo(req),
        });
        return after;
      } catch (err) {
        if (
          err.message.includes('outrank') ||
          err.message.includes('not found')
        ) {
          return reply.status(400).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // Reassign a member to a different manager inside the requester's team.
  fastify.patch(
    '/members/:id/manager',
    {
      preHandler: [
        auth,
        rbac(...MANAGER_ROLES),
        requireFreshRole,
        ownership('id'),
        sanitize,
      ],
      schema: {
        tags: ['Team'],
        description: 'Change member manager',
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: toSchema(changeManagerSchema),
      },
    },
    async (req, reply) => {
      const { manager_id } = z
        .object({ manager_id: z.string().uuid() })
        .parse(req.body);

      if (manager_id === req.params.id) {
        return reply
          .status(400)
          .send({ error: 'A member cannot be their own manager' });
      }

      const member = await repo.getMemberById(req.params.id);
      if (!member) return reply.status(404).send({ error: 'Member not found' });

      // The new manager must be the requester or inside the requester's team.
      if (manager_id !== req.user.id && req.user.role !== 'ADMIN') {
        const managerInTeam = await checkHierarchyAccess(
          req.user.id,
          manager_id
        );
        if (!managerInTeam) {
          return reply
            .status(403)
            .send({ error: 'Chosen manager is not in your team' });
        }
      }

      // The new manager must outrank the member.
      const managerRole =
        manager_id === req.user.id
          ? req.user.role
          : await repo.getUserRole(manager_id);
      if (!managerRole)
        return reply.status(400).send({ error: 'Manager not found' });
      if (ROLE_RANK[member.role] >= ROLE_RANK[managerRole]) {
        return reply.status(400).send({
          error: `Manager (${managerRole}) must outrank the member (${member.role})`,
        });
      }

      // Prevent cycles: the new manager must not be the member or a descendant
      // of the member (i.e. the member must not already manage the new manager).
      const wouldCycle = await checkHierarchyAccess(req.params.id, manager_id);
      if (wouldCycle) {
        return reply
          .status(400)
          .send({ error: 'That assignment would create a cycle' });
      }

      try {
        const after = await repo.updateMemberManager(req.params.id, manager_id);
        await createAuditLog({
          userId: req.user.id,
          action: 'MEMBER_MANAGER_CHANGED',
          resourceType: 'user',
          resourceId: req.params.id,
          oldValue: { manager_id: member.manager_id },
          newValue: { manager_id },
          ...extractRequestInfo(req),
        });
        return after;
      } catch (err) {
        if (
          err.message.includes('cycle') ||
          err.message.includes('outrank') ||
          err.message.includes('not found')
        ) {
          return reply.status(400).send({ error: err.message });
        }
        throw err;
      }
    }
  );
}

module.exports = routes;
