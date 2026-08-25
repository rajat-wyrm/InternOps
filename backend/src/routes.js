const noticesRoutes = require('./modules/notices/routes');

const V1_DEPRECATED = process.env.V1_DEPRECATED === 'true';
const V1_DEPRECATION_DATE = process.env.V1_DEPRECATION_DATE || '';
const V1_SUNSET_DATE = process.env.V1_SUNSET_DATE || '';

module.exports = async function routes(fastify) {
  if (V1_DEPRECATED) {
    fastify.addHook('onSend', async (request, reply) => {
      if (V1_DEPRECATION_DATE) reply.header('Deprecation', V1_DEPRECATION_DATE);
      if (V1_SUNSET_DATE) reply.header('Sunset', V1_SUNSET_DATE);
      reply.header('Link', '</api/v2>; rel="successor-version"');
    });
  }

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
  fastify.register(require('./modules/ratings/routes'), { prefix: '/ratings' });
  fastify.register(require('./modules/social-tasks/routes'), {
    prefix: '/tasks',
  });
  fastify.register(require('./modules/onboarding/routes'), {
    prefix: '/onboarding',
  });
  fastify.register(require('./modules/proof-submissions/routes'), {
    prefix: '/proofs',
  });
  fastify.register(require('./modules/notifications/routes'), {
    prefix: '/notifications',
  });
  fastify.register(require('./modules/audit/routes'), { prefix: '/audit' });
  fastify.register(require('./modules/uploads/routes'), { prefix: '/uploads' });
  fastify.register(require('./modules/analytics/routes'), {
    prefix: '/analytics',
  });
  fastify.register(require('./modules/meetings/routes'), {
    prefix: '/meetings',
  });
  fastify.register(require('./modules/sessions/routes'), {
    prefix: '/sessions',
  });
  fastify.register(require('./modules/reports/routes'), { prefix: '/reports' });
  fastify.register(require('./modules/reports/export'), {
    prefix: '/reports/export',
  });
  fastify.register(require('./modules/ai/routes'), { prefix: '/ai' });
  fastify.register(require('./modules/uptoskills/routes'), {
    prefix: '/uptoskills',
  });
  fastify.register(noticesRoutes);
  fastify.register(require('./modules/certificates/routes'), {
    prefix: '/certificates',
  });
  fastify.register(require('./modules/canva/routes'), { prefix: '/canva' });
  fastify.register(require('./modules/ai-certificates/routes'), {
    prefix: '/ai-certificates',
  });
  fastify.register(require('./modules/feature-flags/routes'), {
    prefix: '/feature-flags',
  });
  fastify.register(require('./modules/github-sync/index'), {
    prefix: '/github',
  });
  fastify.register(require('./modules/assessments/routes'), {
    prefix: '/assessments',
  });

  const { verifyCertificate } = require('./modules/certificates/verify');
  verifyCertificate(fastify);
};
