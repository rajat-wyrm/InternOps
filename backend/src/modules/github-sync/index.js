const githubSyncRoutes = require('./routes');

module.exports = async function githubSyncPlugin(fastify, opts) {
  await fastify.register(githubSyncRoutes, opts);
};

module.exports.autoPrefix = '/github';
