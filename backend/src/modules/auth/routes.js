const service = require('./service');
const { z } = require('zod');
const rbac = require('../../middleware/rbac');
const { bruteForceCheck } = require('../../middleware/bruteForce');
const auth = require('../../middleware/auth');
const { extractRequestInfo } = require('../../utils/audit');
const isProduction = process.env.NODE_ENV === 'production';
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
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      };
    }
  );

  // Refresh token
  fastify.post(
    '/refresh',
    {
      schema: { tags: ['Authentication'], description: 'Refresh access token' },
    },
    async (req, reply) => {
      const token = req.cookies.refreshToken || req.body.refreshToken;
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
        refreshToken: tokens.refreshToken,
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
      return { message: 'Logged out' };
    }
  );

  // Get CSRF token
  fastify.get('/csrf-token', async (req, reply) => {
    const { generateToken } = require('../../middleware/csrf');
    return { csrfToken: generateToken() };
  });

  // Verify email
  fastify.post('/verify-email', async (req, reply) => {
    const schema = z.object({ token: z.string() });
    const { token } = schema.parse(req.body);
    const { verifyEmail } = require('./verificationService');
    await verifyEmail(token);
    return { message: 'Email verified successfully. You can now log in.' };
  });

  // Resend verification email
  fastify.post(
    '/resend-verification',
    { preHandler: [auth] },
    async (req, reply) => {
      const repo = require('./repository');
      const user = await repo.findById(req.user.id);
      if (!user) return reply.status(404).send({ error: 'User not found' });
      const { sendVerificationEmail } = require('./verificationService');
      await sendVerificationEmail(user.id, user.email);
      return { message: 'Verification email sent.' };
    }
  );

  // Forgot password
  fastify.post('/forgot-password', async (req, reply) => {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);
    await require('./resetService').forgotPassword(
      email,
      extractRequestInfo(req)
    );
    return { message: 'If that email exists, a reset link has been sent.' };
  });

  // Reset password
  fastify.post('/reset-password', async (req, reply) => {
    const schema = z.object({
      token: z.string(),
      newPassword: z.string().min(8),
    });
    const { token, newPassword } = schema.parse(req.body);
    await require('./resetService').resetPassword(
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
