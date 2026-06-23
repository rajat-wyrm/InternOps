const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const ownership = require('../../middleware/ownership');
const requireFreshRole = require('../../middleware/requireFreshRole');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { checkHierarchyAccess, ROLE_RANK } = require('../../utils/hierarchy');
const { withHierarchyTx } = require('../../utils/dbTx');
const { z } = require('zod');

// Roles that manage a team
const MANAGER_ROLES = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'];
// Roles a manager can assign
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
  fastify.get(
    '/members',
    { preHandler: [auth, rbac(...MANAGER_ROLES)] },
    async (req) => repo.getTeamMembers(req.user.id)
  );

  fastify.get(
    '/members/export',
    { preHandler: [auth, rbac(...MANAGER_ROLES)] },
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

  fastify.get(
    '/pending-proofs',
    { preHandler: [auth, rbac(...MANAGER_ROLES)] },
    async (req) => repo.getPendingProofs(req.user.id)
  );

  fastify.post(
    '/members',
    { preHandler: [auth, rbac(...MANAGER_ROLES)] },
    async (req, reply) => {
      const data = createSchema.parse(req.body);
      const managerId = data.manager_id || req.user.id;

      const result = await withHierarchyTx([managerId], async (client) => {
        if (managerId !== req.user.id && req.user.role !== 'ADMIN') {
          const inTeam = await checkHierarchyAccess(
            req.user.id,
            managerId,
            client
          );
          if (!inTeam)
            return {
              errStatus: 403,
              errMessage: 'Chosen manager is not in your team',
            };
        }
        const managerRole =
          managerId === req.user.id
            ? req.user.role
            : await repo.getUserRole(managerId, client);
        if (!managerRole)
          return { errStatus: 400, errMessage: 'Manager not found' };

        if (
          ROLE_RANK[data.role] === undefined ||
          ROLE_RANK[data.role] >= ROLE_RANK[managerRole]
        ) {
          return {
            errStatus: 400,
            errMessage: `You can only add members below your own role (${managerRole})`,
          };
        }
        if (await repo.emailExists(data.email, client))
          return { errStatus: 409, errMessage: 'Email already exists' };

        const member = await repo.createMember(
          { ...data, manager_id: managerId },
          client
        );
        return { success: true, member };
      });

      if (result.errStatus)
        return reply
          .status(result.errStatus)
          .send({ error: result.errMessage });

      const { member } = result;
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'MEMBER_CREATED',
        resourceType: 'user',
        resourceId: member.id,
        newValue: { email: member.email, role: member.role },
        ...extractRequestInfo(req),
      };
      return reply.status(201).send(member);
    }
  );

  fastify.get(
    '/members/:id',
    { preHandler: [auth, rbac(...MANAGER_ROLES), ownership('id')] },
    async (req, reply) => {
      const member = await repo.getMemberById(req.params.id);
      return member || reply.status(404).send({ error: 'Member not found' });
    }
  );

  fastify.get(
    '/members/:id/history',
    { preHandler: [auth, rbac(...MANAGER_ROLES), ownership('id')] },
    async (req) => repo.getMemberHistory(req.params.id)
  );

  fastify.patch(
    '/members/:id',
    { preHandler: [auth, rbac(...MANAGER_ROLES), ownership('id')] },
    async (req, reply) => {
      const data = updateSchema.parse(req.body);
      const before = await repo.getMemberById(req.params.id);
      if (!before) return reply.status(404).send({ error: 'Member not found' });
      const after = await repo.updateMember(req.params.id, data);

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'MEMBER_DETAILS_UPDATED',
        resourceType: 'user',
        resourceId: req.params.id,
        oldValue: before,
        newValue: after,
        ...extractRequestInfo(req),
      };
      return after;
    }
  );

  fastify.patch(
    '/members/:id/status',
    {
      preHandler: [
        auth,
        requireFreshRole,
        rbac(...MANAGER_ROLES),
        ownership('id'),
      ],
    },
    async (req, reply) => {
      const { suspended } = z
        .object({ suspended: z.boolean() })
        .parse(req.body);
      const result = await withHierarchyTx([req.params.id], async (client) => {
        const m = await repo.setMemberStatus(req.params.id, suspended, client);
        if (!m) return { errStatus: 404, errMessage: 'Member not found' };
        return { success: true, member: m };
      });

      if (result.errStatus)
        return reply
          .status(result.errStatus)
          .send({ error: result.errMessage });

      req.auditOnResponse = {
        userId: req.user.id,
        action: suspended ? 'MEMBER_SUSPENDED' : 'MEMBER_ACTIVATED',
        resourceType: 'user',
        resourceId: req.params.id,
        ...extractRequestInfo(req),
      };
      return result.member;
    }
  );

  fastify.patch(
    '/members/:id/role',
    {
      preHandler: [
        auth,
        requireFreshRole,
        rbac(...MANAGER_ROLES),
        ownership('id'),
      ],
    },
    async (req, reply) => {
      const { role } = z
        .object({ role: z.enum(ASSIGNABLE_ROLES) })
        .parse(req.body);
      if (req.params.id === req.user.id)
        return reply.status(403).send({ error: 'Cannot change own role' });
      if (
        req.user.role !== 'ADMIN' &&
        ROLE_RANK[role] >= ROLE_RANK[req.user.role]
      ) {
        return reply.status(403).send({
          error: `Only assign roles below your own (${req.user.role})`,
        });
      }

      const result = await withHierarchyTx([req.params.id], async (client) => {
        const before = await repo.getMemberById(req.params.id, client);
        if (!before) return { errStatus: 404, errMessage: 'Member not found' };
        const reportRoles = await repo.getDirectReportRoles(
          req.params.id,
          client
        );
        if (
          reportRoles.reduce(
            (max, r) => Math.max(max, ROLE_RANK[r] ?? 0),
            -1
          ) >= ROLE_RANK[role]
        ) {
          return {
            errStatus: 400,
            errMessage: 'New role must outrank existing reports',
          };
        }
        const after = await repo.updateMemberRole(req.params.id, role, client);
        return { success: true, before, after };
      });

      if (result.errStatus)
        return reply
          .status(result.errStatus)
          .send({ error: result.errMessage });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'MEMBER_ROLE_CHANGED',
        resourceType: 'user',
        resourceId: req.params.id,
        oldValue: { role: result.before.role },
        newValue: { role: result.after.role },
        ...extractRequestInfo(req),
      };
      return result.after;
    }
  );

  fastify.patch(
    '/members/:id/manager',
    { preHandler: [auth, rbac(...MANAGER_ROLES), ownership('id')] },
    async (req, reply) => {
      const { manager_id } = z
        .object({ manager_id: z.string().uuid() })
        .parse(req.body);
      if (manager_id === req.params.id)
        return reply.status(400).send({ error: 'Cannot be own manager' });

      const result = await withHierarchyTx(
        [req.params.id, manager_id],
        async (client) => {
          const member = await repo.getMemberById(req.params.id, client);
          if (!member)
            return { errStatus: 404, errMessage: 'Member not found' };
          if (
            manager_id !== req.user.id &&
            req.user.role !== 'ADMIN' &&
            !(await checkHierarchyAccess(req.user.id, manager_id, client))
          ) {
            return { errStatus: 403, errMessage: 'Chosen manager not in team' };
          }
          const managerRole =
            manager_id === req.user.id
              ? req.user.role
              : await repo.getUserRole(manager_id, client);
          if (!managerRole || ROLE_RANK[member.role] >= ROLE_RANK[managerRole])
            return {
              errStatus: 400,
              errMessage: 'Manager must outrank member',
            };
          if (await checkHierarchyAccess(req.params.id, manager_id, client))
            return { errStatus: 400, errMessage: 'Cycle detected' };

          const after = await repo.updateMemberManager(
            req.params.id,
            manager_id,
            client
          );
          return { success: true, member, after };
        }
      );

      if (result.errStatus)
        return reply
          .status(result.errStatus)
          .send({ error: result.errMessage });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'MEMBER_MANAGER_CHANGED',
        resourceType: 'user',
        resourceId: req.params.id,
        oldValue: { manager_id: result.member.manager_id },
        newValue: { manager_id },
        ...extractRequestInfo(req),
      };
      return result.after;
    }
  );
}

module.exports = routes;
