const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
async function routes(fastify) {
  fastify.get('/', { preHandler: [auth, rbac('ADMIN')] }, async (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const offset = (page - 1) * limit;
    const { records, total } = await repo.getAuditLogs(limit, offset);
    return {
      data: records,
      total,
      page,
      limit,
    };
  });
}
module.exports = routes;
