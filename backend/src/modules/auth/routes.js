const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const service = require('./service');
const { z } = require('zod');
const rbac = require('../../middleware/rbac');
const { bruteForceCheck } = require('../../middleware/bruteForce');
const auth = require('../../middleware/auth');
const audit = require('../../utils/audit');
const {
  generateToken,
  rotateSession,
  rotateAndSetCsrf,
} = require('../../middleware/csrf');
const { verifyEmail, sendVerificationEmail } = require('./verificationService');
const repo = require('./repository');
const { forgotPassword, resetPassword } = require('./resetService');
const { toSchema } = require('../../utils/schemaHelper');
const isProduction = process.env.NODE_ENV === 'production';
const pLimit = require('p-limit');

async function routes(fastify) {
  // Register
  fastify.post(
    '/register',
    {
      preHandler: [auth, rbac('ADMIN'), sanitize],
      schema: {
        tags: ['Authentication'],
        description: 'Register a new user (Admin only)',
        body: {
          type: 'object',
          required: ['email', 'password', 'role'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            role: {
              type: 'string',
              enum: ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'],
            },
            managerId: { type: 'string', format: 'uuid' },
            departmentId: { type: 'string', format: 'uuid' },
            fullName: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN']),
        managerId: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        fullName: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const user = await service.register(data, req.user);
      return reply.status(201).send(user);
    }
  );

  // Bulk Register
  fastify.post(
    '/register/bulk',
    {
      preHandler: [auth, rbac('ADMIN'), sanitize],
      schema: {
        tags: ['Authentication'],
        description: 'Bulk register users (Admin only)',
        body: {
          type: 'object',
          required: ['users'],
          properties: {
            users: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: {
                type: 'object',
                required: ['email', 'password', 'role'],
                properties: {
                  fullName: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  role: {
                    type: 'string',
                    enum: ['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'],
                  },
                  managerId: { type: 'string', format: 'uuid' },
                  departmentId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        response: {
          207: {
            type: 'object',
            properties: {
              success: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    id: { type: 'string' },
                  },
                },
              },
              failed: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const userSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN']),
        managerId: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        fullName: z.string().optional(),
      });
      const schema = z.object({ users: z.array(userSchema).min(1).max(100) });
      const { users } = schema.parse(req.body);

      const ROLE_HIERARCHY = ['INTERN', 'CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'];
      const callerLevel = ROLE_HIERARCHY.indexOf(req.user.role);

      const results = { success: [], failed: [] };
      const limit = pLimit(5); // max 5 concurrent registrations

      await Promise.allSettled(
        users.map((userData) =>
          limit(async () => {
            const targetLevel = ROLE_HIERARCHY.indexOf(userData.role);

            // Handle unknown roles
            if (callerLevel === -1 || targetLevel === -1) {
              results.failed.push({
                email: userData.email,
                error: 'Invalid role specified.',
              });
              return;
            }

            if (targetLevel >= callerLevel) {
              results.failed.push({
                email: userData.email,
                error: 'Cannot assign a role equal to or higher than your own.',
              });
              return;
            }

            try {
              const user = await service.register(userData, req.user);
              results.success.push({ email: userData.email, id: user.id });
            } catch (err) {
              // Log without password
              req.log.error(
                { email: userData.email, code: err.code, message: err.message },
                'Bulk register failed for user'
              );

              // Structured error classification
              let safeMessage = 'Failed to create user.';
              if (err.code === '23505') safeMessage = 'Email already exists.';
              else if (err.code === '23503')
                safeMessage = 'Invalid manager or department ID.';
              else if (err.statusCode === 400) safeMessage = err.message;

              results.failed.push({
                email: userData.email,
                error: safeMessage,
              });
            }
          })
        )
      );

      return reply.status(207).send(results);
    }
  );

  // Login
  fastify.post(
    '/login',
    {
      preHandler: [bruteForceCheck, sanitize],
      schema: {
        tags: ['Authentication'],
        description: 'Login with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = z
        .object({ email: z.string().email(), password: z.string() })
        .parse(req.body);
      const userAgent = req.headers['user-agent'];
      const result = await service.login(email, password, req.ip, userAgent);
      reply.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/api/auth/refresh',
      });

      rotateAndSetCsrf(req, reply, result.user.id);

      req.auditOnResponse = {
        userId: result.user.id,
        action: 'LOGIN',
        resourceType: 'auth',
        resourceId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const response = {
        accessToken: result.accessToken,
        user: result.user,
      };

      reply.send(response);

      req.log.info(
        { action: 'LOGIN', userId: result.user.id, ip: req.ip, userAgent },
        'login success'
      );
    }
  );

  // Refresh token
  fastify.post(
    '/refresh',
    {
      preHandler: [sanitize],
      schema: { tags: ['Authentication'], description: 'Refresh access token' },
    },
    async (req, reply) => {
      const token = req.cookies.refreshToken;

      if (!token) {
        return reply.status(400).send({ error: 'Refresh token required' });
      }

      const tokens = await service.refreshTokens(token, req.ip);

      reply.setCookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/api/auth/refresh',
      });

      return {
        accessToken: tokens.accessToken,
        user: tokens.user,
      };
    }
  );

  // Logout
  fastify.post(
    '/logout',
    {
      preHandler: [auth, sanitize],
      schema: {
        tags: ['Authentication'],
        description: 'Logout and revoke refresh token',
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const token = req.cookies.refreshToken || req.body?.refreshToken;
      if (!token) {
        return reply.status(400).send({
          error: 'Refresh token required',
        });
      }
      await service.logout(
        token,
        req.user.id,
        req.user.jti,
        req.user.exp,
        req.ip,
        req.headers['user-agent']
      );

      reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'LOGOUT',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      rotateAndSetCsrf(req, reply, null);
      return { message: 'Logged out' };
    }
  );

  // Get CSRF token
  fastify.get(
    '/csrf-token',
    { schema: { tags: ['Authentication'], description: 'Get CSRF token' } },
    async (req, reply) => {
      const csrfToken = generateToken(req, reply);
      reply.setCookie('csrf-token', csrfToken, {
        httpOnly: false,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/',
      });
      return { csrfToken };
    }
  );

  // Verify email
  fastify.post(
    '/verify-email',
    {
      preHandler: [sanitize],
      schema: {
        tags: ['Authentication'],
        description: 'Verify email with token',
        body: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      await verifyEmail(token);
      return { message: 'Email verified successfully. You can now log in.' };
    }
  );

  // Resend verification email
  fastify.post(
    '/resend-verification',
    {
      preHandler: [auth, sanitize],
      schema: {
        tags: ['Authentication'],
        description: 'Resend verification email',
      },
    },
    async (req, reply) => {
      const user = await repo.findById(req.user.id);
      if (!user) return reply.status(404).send({ error: 'User not found' });
      await sendVerificationEmail(user.id, user.email);
      return { message: 'Verification email sent.' };
    }
  );

  // Forgot password
  fastify.post(
    '/forgot-password',
    {
      preHandler: [sanitize],
      schema: {
        tags: ['Authentication'],
        description: 'Send password reset email',
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
      },
    },
    async (req, reply) => {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      await forgotPassword(email, audit.extractRequestInfo(req));
      return { message: 'If that email exists, a reset link has been sent.' };
    }
  );

  // Reset password
  fastify.post(
    '/reset-password',
    {
      preHandler: [sanitize],
      schema: {
        tags: ['Authentication'],
        description: 'Reset password with token',
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (req, reply) => {
      const { token, newPassword } = z
        .object({ token: z.string(), newPassword: z.string().min(8) })
        .parse(req.body);
      await resetPassword(token, newPassword, audit.extractRequestInfo(req));
      return {
        message:
          'Password reset successful. Please log in with your new password.',
      };
    }
  );
}

module.exports = routes;
