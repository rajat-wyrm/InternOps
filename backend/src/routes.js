const noticesRoutes = require('./modules/notices/routes');

// ---------------------------------------------------------------------------
// Deprecation header hook
// ---------------------------------------------------------------------------
// When V1_DEPRECATED=true is set in the environment every response served
// from this v1 router will include the standard deprecation headers so that
// API clients (browsers, mobile apps, third-party integrations) can detect
// the upcoming sunset window programmatically.
//
// Required env vars when V1_DEPRECATED=true:
//   V1_DEPRECATION_DATE – RFC-1123 date when the deprecation was announced,
//                         e.g. "Sat, 01 Jan 2028 00:00:00 GMT"
//   V1_SUNSET_DATE      – RFC-1123 date when v1 will stop accepting requests,
//                         e.g. "Mon, 01 Apr 2028 00:00:00 GMT" (≥ 90 days after deprecation)
// ---------------------------------------------------------------------------
const V1_DEPRECATED = process.env.V1_DEPRECATED === 'true';
const V1_DEPRECATION_DATE = process.env.V1_DEPRECATION_DATE || '';
const V1_SUNSET_DATE = process.env.V1_SUNSET_DATE || '';

module.exports = async function routes(fastify, opts) {
  // Inject Deprecation / Sunset / Link headers on every v1 response when the
  // sunset window has been activated. This is a no-op in normal operation.
  if (V1_DEPRECATED) {
    fastify.addHook('onSend', async (request, reply) => {
      if (V1_DEPRECATION_DATE) {
        reply.header('Deprecation', V1_DEPRECATION_DATE);
      }
      if (V1_SUNSET_DATE) {
        reply.header('Sunset', V1_SUNSET_DATE);
      }
      // Point clients to the successor version.
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

  // Public certificate verification (no auth)
  const { verifyCertificate } = require('./modules/certificates/verify');
  verifyCertificate(fastify);
};
