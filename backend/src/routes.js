const noticesRoutes = require('./modules/notices/routes');

module.exports = async function routes(fastify, opts) {
  fastify.register(require('./modules/auth/routes'), { prefix: '/auth' });
  fastify.register(require('./modules/users/routes'), { prefix: '/users' });
  fastify.register(require('./modules/departments/routes'), {
    prefix: '/departments',
  });
  fastify.register(require('./modules/hierarchy/routes'), {
    prefix: '/hierarchy',
  });
  fastify.register(require('./modules/team/routes'), { prefix: '/team' });
  fastify.register(require('./modules/attendance/routes'), {
    prefix: '/attendance',
  });
  fastify.register(require('./modules/ratings/routes'), {
    prefix: '/ratings',
  });
  fastify.register(require('./modules/social-tasks/routes'), {
    prefix: '/tasks',
  });
  fastify.register(require('./modules/proof-submissions/routes'), {
    prefix: '/proofs',
  });
  fastify.register(require('./modules/notifications/routes'), {
    prefix: '/notifications',
  });
  fastify.register(require('./modules/audit/routes'), { prefix: '/audit' });
  fastify.register(require('./modules/uploads/routes'), {
    prefix: '/uploads',
  });
  fastify.register(require('./modules/analytics/routes'), {
    prefix: '/analytics',
  });
  fastify.register(require('./modules/meetings/routes'), {
    prefix: '/meetings',
  });
  fastify.register(require('./modules/sessions/routes'), {
    prefix: '/sessions',
  });
  fastify.register(require('./modules/reports/routes'), {
    prefix: '/reports',
  });
  fastify.register(require('./modules/reports/export'), {
    prefix: '/reports/export',
  });
  fastify.register(require('./modules/ai/routes'), { prefix: '/ai' });
  fastify.register(require('./modules/uptoskills/routes'), {
    prefix: '/uptoskills',
  });
  fastify.register(noticesRoutes);
};
