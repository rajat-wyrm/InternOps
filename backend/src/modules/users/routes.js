const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const ownership = require('../../middleware/ownership');
const repo = require('./repository');
const argon2 = require('argon2');
const { z } = require('zod');
const authRepo = require('../auth/repository');
const { toSchema } = require('../../utils/schemaHelper');
const { isValidStep, checkHierarchyAccess } = require('../../utils/hierarchy');

const SENIOR_TL_MANAGEABLE_ROLES = new Set(['TL', 'CAPTAIN', 'INTERN']);
const TL_MANAGEABLE_ROLES = new Set(['CAPTAIN', 'INTERN']);

async function authorizeUserManagement(req, reply, targetUser, action) {
  if (req.user.role === 'ADMIN') return true;

  if (req.user.role === 'SENIOR_TL') {
    const allowed =
      req.user.id !== targetUser.id &&
      req.user.departmentId &&
      targetUser.department_id === req.user.departmentId &&
      SENIOR_TL_MANAGEABLE_ROLES.has(targetUser.role);
    if (!allowed) {
      reply.status(403).send({ error: `Senior TL cannot ${action} this user` });
      return false;
    }
    return true;
  }

  if (req.user.role === 'TL') {
    // TL can only manage CAPTAIN and INTERN
    if (!TL_MANAGEABLE_ROLES.has(targetUser.role)) {
      reply.status(403).send({
        error: `TL can only ${action} Captains and Interns`,
      });
      return false;
    }

    // TL cannot manage self
    if (req.user.id === targetUser.id) {
      reply.status(403).send({
        error: `You cannot ${action} your own account`,
      });
      return false;
    }

    // TL must have hierarchy access
    const ok = await checkHierarchyAccess(req.user.id, targetUser.id);
    if (!ok) {
      reply.status(403).send({
        error: `TL cannot ${action} this user`,
      });
      return false;
    }

    return true;
  }

  reply.status(403).send({ error: `Cannot ${action} this user` });
  return false;
}

const listUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN']).optional(),
  department_id: z
    .union([z.string().uuid(), z.literal('unassigned')])
    .optional(),
  suspended: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['name', 'created_at', 'last_login'])
    .optional()
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

const USER_ROLES = [
  'ADMIN',
  'MANAGEMENT',
  'HR',
  'SENIOR_TL',
  'TL',
  'CAPTAIN',
  'INTERN',
];

const updateUserSchema = z
  .object({
    full_name: z.string().trim().min(1).max(255).optional(),
    email: z.string().trim().email().max(255).optional(),
    role: z.enum(USER_ROLES).optional(),
    department_id: z.string().uuid().nullable().optional(),
    manager_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one editable field is required',
  });

const allowedAvatarExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const isValidAvatarUrl = (val) => {
  if (typeof val !== 'string') return false;
  if (val.startsWith('/uploads/')) return true;

  try {
    const url = new URL(val);

    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const pathname = url.pathname.toLowerCase();
    return allowedAvatarExtensions.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
};

const changePasswordSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(8),
});

const updateProfileSchema = z.object({
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
  avatar_url: z
    .string()
    .url()
    .regex(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)
    .optional(),
});

async function routes(fastify) {
  // Admin: list users (paginated, searchable, sortable with total count)
  fastify.get(
    '/users',
    {
      schema: {
        querystring: toSchema(listUsersQuerySchema, 'querystring'),
      },
      preHandler: [auth, rbac(['ADMIN', 'SENIOR_TL', 'TL'])],
    },
    async (request, reply) => {
      try {
        const query = listUsersQuerySchema.parse(request.query);
        const result = await repo.findPaginated(query);
        return reply.send(result);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          error: 'Failed to fetch users',
          message: error.message,
        });
      }
    }
  );

  // GET /users/:id - Get single user
  fastify.get(
    '/users/:id',
    {
      preHandler: [auth],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const result = await repo.findById(id);
        if (!result) {
          return reply.status(404).send({ error: 'User not found' });
        }
        return reply.send(result);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch user' });
      }
    }
  );

  // POST /users - Create user
  fastify.post(
    '/users',
    {
      preHandler: [auth, rbac(['ADMIN']), sanitize],
    },
    async (request, reply) => {
      try {
        const userData = request.body;
        const result = await repo.create(userData);
        return reply.status(201).send(result);
      } catch (error) {
        request.log.error(error);
        if (error.code === '23505') {
          return reply
            .status(409)
            .send({ error: 'User with this email already exists' });
        }
        return reply.status(500).send({ error: 'Failed to create user' });
      }
    }
  );

  // PUT /users/:id - Update user
  fastify.put(
    '/users/:id',
    {
      preHandler: [auth, ownership, sanitize],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const updates = request.body;
        const result = await repo.update(id, updates);
        if (!result) {
          return reply.status(404).send({ error: 'User not found' });
        }
        return reply.send(result);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to update user' });
      }
    }
  );

  // DELETE /users/:id - Delete user
  fastify.delete(
    '/users/:id',
    {
      preHandler: [auth, rbac(['ADMIN'])],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const result = await repo.delete(id);
        if (!result) {
          return reply.status(404).send({ error: 'User not found' });
        }
        return reply.status(204).send();
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Failed to delete user' });
      }
    }
  );
}

module.exports = routes;
