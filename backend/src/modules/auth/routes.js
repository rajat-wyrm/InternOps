const service = require('./service');
const { z } = require('zod');
const rbac = require('../../middleware/rbac');
const { bruteForceCheck } = require('../../middleware/bruteForce');
const auth = require('../../middleware/auth');
const { extractRequestInfo } = require('../../utils/audit');
const { generateToken } = require('../../middleware/csrf');
const { verifyEmail, sendVerificationEmail } = require('./verificationService');
const repo = require('./repository');
const { forgotPassword, resetPassword } = require('./resetService');
const isProduction = process.env.NODE_ENV === 'production';
const { createAuditLog } = require('../../utils/audit');
async function routes(fastify) {
  // Register
  fastify.post(
    '/register',
    {
      preHandler: [auth, rbac('ADMIN')],
      schema: {
        tags: ['Authentication'],
        description: 'Register a new user (Admin only)',
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

  // Login
  fastify.post(
    '/login',
    {
      preHandler: [bruteForceCheck],
      schema: {
        tags: ['Authentication'],
        description: 'Login with email and password',
      },
    },
    async (req, reply) => {
      const { email, password } = z
        .object({ email: z.string().email(), password: z.string() })
        .parse(req.body);

      const result = await service.login(
        email,
        password,
        req.ip,
        req.headers['user-agent']
      );

      reply.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/api/auth/refresh',
      });

      const { rotateAndSetCsrf } = require('../../middleware/csrf');
      rotateAndSetCsrf(req, reply, result.user.id);

      // From fix/deferred-audit-log-486
      req.auditOnResponse = {
        userId: result.user.id,
        action: 'LOGIN',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      // From master
      const response = {
        accessToken: result.accessToken,
        user: result.user,
      };

      reply.send(response);

      req.log.info(
        {
          action: 'LOGIN',
          userId: result.user.id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
        'login success'
      );

      createAuditLog({
        userId: result.user.id,
        action: 'LOGIN',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch((err) => req.log.error(err, 'audit log failed'));
    }
  );

  // Refresh token
  fastify.post(
    '/refresh',
    {
      schema: { tags: ['Authentication'], description: 'Refresh access token' },
    },
    async (req, reply) => {
      const token = req.cookies.refreshToken;
      if (!token)
        return reply.status(400).send({ error: 'Refresh token required' });
      const tokens = await service.refreshTokens(token, req.ip);
      reply.setCookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/api/auth/refresh',
      });
      return {
        accessToken: tokens.accessToken,
      };
    }
  );

  // Logout
  fastify.post(
    '/logout',
    {
      preHandler: [auth],
      schema: {
        tags: ['Authentication'],
        description: 'Logout and revoke refresh token',
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
        req.ip,
        req.headers['user-agent']
      );

      reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });

      // From fix/deferred-audit-log-486
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'LOGOUT',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      reply.clearCookie('csrf-sid', { path: '/' });
      reply.clearCookie('csrf-token', { path: '/' });

      return { message: 'Logged out' };
    }
  );

  // Get CSRF token
  fastify.get('/csrf-token', async (req, reply) => {
    const { generateToken } = require('../../middleware/csrf');
    const csrfToken = generateToken(req, reply);
    // Also expose the token in a non-HttpOnly cookie so the SPA can
    // echo it in the X-CSRF-Token header on mutation requests. The
    // actual validation is bound to the signed session cookie, not this
    // readable one.
    reply.setCookie('csrf-token', csrfToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });
    return { csrfToken };
  });

  // Verify email
  fastify.post('/verify-email', async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    await verifyEmail(token);
    return { message: 'Email verified successfully. You can now log in.' };
  });

  // Resend verification email
  fastify.post(
    '/resend-verification',
    { preHandler: [auth] },
    async (req, reply) => {
      const user = await repo.findById(req.user.id);
      if (!user) return reply.status(404).send({ error: 'User not found' });
      await sendVerificationEmail(user.id, user.email);
      return { message: 'Verification email sent.' };
    }
  );

  // Forgot password
  fastify.post('/forgot-password', async (req, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    req.auditOnResponse = await forgotPassword(email, extractRequestInfo(req));
    return { message: 'If that email exists, a reset link has been sent.' };
  });

  // Reset password
  fastify.post('/reset-password', async (req, reply) => {
    const { token, newPassword } = z
      .object({ token: z.string(), newPassword: z.string().min(8) })
      .parse(req.body);
    req.auditOnResponse = await resetPassword(
      token,
      newPassword,
      extractRequestInfo(req)
    );
    return {
      message:
        'Password reset successful. Please log in with your new password.',
    };
  });
}

module.exports = routes;
