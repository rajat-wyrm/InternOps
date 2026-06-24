const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const ownership = require('../../middleware/ownership');
const repo = require('./repository');
const argon2 = require('argon2');
const { z } = require('zod');
const authRepo = require('../auth/repository');

const listUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN']).optional(),
  suspended: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

async function routes(fastify) {
  // Admin: list users (paginated, with total count)
  fastify.get(
    '/',
    { preHandler: [auth, rbac('ADMIN')] },
    async (req, reply) => {
      const parsed = listUsersQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: parsed.error.issues,
        });
      }

      const { search, role, suspended, page, limit } = parsed.data;
      const offset = (page - 1) * limit;

      return repo.listUsersPaginated({
        search,
        role,
        suspended,
        page,
        limit,
        offset,
      });
    }
  );

  // Get own profile
  fastify.get('/me', { preHandler: [auth] }, async (req) => {
    const {
      rows: [user],
    } = await repo.getUserById(req.user.id);
    return user;
  });

  // Get single user (ownership check)
  fastify.get(
    '/:id',
    { preHandler: [auth, ownership('id')] },
    async (req, reply) => {
      const {
        rows: [user],
      } = await repo.getUserById(req.params.id);
      return user || reply.status(404).send({ error: 'Not found' });
    }
  );

  // Suspend / Activate / Soft delete (admin only)
  fastify.patch(
    '/:id/suspend',
    { preHandler: [auth, rbac('ADMIN')] },
    async (req) => {
      await repo.suspendUser(req.params.id);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'USER_SUSPENDED',
        resourceType: 'user',
        resourceId: req.params.id,
      };
      return { message: 'Suspended' };
    }
  );

  fastify.patch(
    '/:id/activate',
    { preHandler: [auth, rbac('ADMIN')] },
    async (req) => {
      await repo.activateUser(req.params.id);
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'USER_ACTIVATED',
        resourceType: 'user',
        resourceId: req.params.id,
      };
      return { message: 'Activated' };
    }
  );

  fastify.delete('/:id', { preHandler: [auth, rbac('ADMIN')] }, async (req) => {
    await repo.softDeleteUser(req.params.id);
    req.auditOnResponse = {
      userId: req.user.id,
      action: 'USER_DELETED',
      resourceType: 'user',
      resourceId: req.params.id,
    };
    return { message: 'Soft-deleted' };
  });

  // Change own password
  fastify.patch('/me/password', { preHandler: [auth] }, async (req, reply) => {
    const schema = z.object({
      oldPassword: z.string(),
      newPassword: z.string().min(8),
    });

    const { oldPassword, newPassword } = schema.parse(req.body);
    const user = await authRepo.findById(req.user.id);

    if (!user) return reply.status(404).send({ error: 'User not found' });

    const valid = await authRepo.verifyPassword(user, oldPassword);

    if (!valid) {
      return reply.status(400).send({ error: 'Current password is incorrect' });
    }

    const newHash = await argon2.hash(newPassword);

    await authRepo.updatePassword(req.user.id, newHash);

    // Use the deferred audit log pattern for consistency
    req.auditOnResponse = {
      userId: req.user.id,
      action: 'PASSWORD_CHANGED',
      resourceType: 'user',
      resourceId: req.user.id,
    };

    return { message: 'Password updated' };
  });

  // Update own profile
  fastify.patch('/me', { preHandler: [auth] }, async (req) => {
    const schema = z.object({
      full_name: z.string().optional(),
      phone: z.string().optional(),
      college: z.string().optional(),
      course: z.string().optional(),
      year_of_study: z.string().optional(),
      position: z.string().optional(),
      joining_date: z.string().optional(),
      internship_status: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
      avatar_url: z.string().optional(),
    });

    const data = schema.parse(req.body);

    await authRepo.updateProfile(req.user.id, data);

    return { message: 'Profile updated' };
  });
}

module.exports = routes;
