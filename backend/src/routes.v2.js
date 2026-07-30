// API v2 router — only mount modules here when a BREAKING change is
// needed (renamed/removed fields, changed HTTP semantics).
// Stable v1 routes continue to work alongside v2.
//
// Example:
//   fastify.register(require('./modules/users/routes.v2'), { prefix: '/users' });

const config = require('./config');

module.exports = async function routesV2(fastify) {
  fastify.get('/health', async () => ({
    status: 'ok',
    version: 'v2',
    timestamp: new Date().toISOString(),
  }));

  fastify.setNotFoundHandler(async (request, reply) => {
    const path = request.raw.url || request.url;

    reply.status(410).send({
      error: 'Gone',
      message: `Route ${request.method} ${path} is not implemented. Use /api/v1 for stable endpoints.`,
      docs: `${config?.appUrl || ''}/docs`,
    });
  });
};
