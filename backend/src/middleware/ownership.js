const { checkHierarchyAccess } = require('../utils/hierarchy');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ownership(paramName = 'id', { requireUuid = true } = {}) {
  return async (request, reply) => {
    const target = request.params[paramName];
    if (!target) {
      return reply
        .status(400)
        .send({ error: `Missing required param: ${paramName}` });
    }
    if (requireUuid && !UUID_REGEX.test(target)) {
      return reply
        .status(400)
        .send({ error: `Invalid ${paramName}: must be a UUID` });
    }
    if (request.user.role === 'ADMIN') {
      return; // admin bypass — audit logged by onResponse hook (#983)
    }
    const ok = await checkHierarchyAccess(request.user.id, target);
    if (!ok) return reply.status(403).send({ error: 'Not in your hierarchy' });
  };
}

module.exports = ownership;
