// backend/src/routes.js

// =============================================
// IMPORTS - All route imports at the top
// =============================================
const userRoutes = require('./modules/users/routes');
const noticesRoutes = require('./modules/notices/routes');
// const authRoutes = require('./modules/auth/routes');
// const teamRoutes = require('./modules/team/routes');
// const taskRoutes = require('./modules/tasks/routes');
// const attendanceRoutes = require('./modules/attendance/routes');
// ... other imports

// =============================================
// MAIN ROUTES PLUGIN
// =============================================
async function routes(fastify, options) {
  // Register all module routes
  fastify.register(userRoutes);
  // fastify.register(authRoutes);
  // fastify.register(teamRoutes);
  // fastify.register(taskRoutes);
  // fastify.register(attendanceRoutes);

  fastify.register(require('./modules/sessions/routes'), {
    prefix: '/sessions',
  });
  fastify.register(require('./modules/reports/routes'), {
    prefix: '/reports',
  });
  fastify.register(require('./modules/report-templates/routes'), {
    prefix: '/report-templates',
  });
  fastify.register(require('./modules/reports/export'), {
    prefix: '/reports/export',
  });
  fastify.register(require('./modules/ai/routes'), { prefix: '/ai' });
  fastify.register(require('./modules/onboarding/routes'), {
    prefix: '/onboarding',
  });
  fastify.register(require('./modules/uptoskills/routes'), {
    prefix: '/uptoskills',
  });
  fastify.register(noticesRoutes);
  fastify.register(require('./modules/certificates/routes'), {
    prefix: '/certificates',
  });
  fastify.register(require('./modules/github-sync/index'), {
    prefix: '/github',
  });

  fastify.register(require('./modules/internops/routes'), {
    prefix: '/internops',
  });

  // Public certificate verification (no auth)
  const { verifyCertificate } = require('./modules/certificates/verify');
  verifyCertificate(fastify);

  // =============================================
  // ROOT ROUTES
  // =============================================
  fastify.get('/ping', async (request, reply) => {
    return reply.send({ pong: true, timestamp: new Date().toISOString() });
  });

  fastify.get('/status', async (request, reply) => {
    return reply.send({
      status: 'ok',
      version: 'v1',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // =============================================
  // HEALTH CHECKS
  // =============================================
  fastify.get('/health', async (request, reply) => {
    // Simple health check - will be overridden by global health route
    return reply.send({ status: 'ok' });
  });

  // =============================================
  // FALLBACK ROUTE FOR UNMATCHED PATHS
  // =============================================
  fastify.all('*', async (request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });
}

module.exports = routes;
