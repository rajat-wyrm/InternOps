const { checkHierarchyAccess } = require('../utils/hierarchy');
const { createAuditLog, extractRequestInfo } = require('../utils/audit');

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
      const { ipAddress, userAgent } = extractRequestInfo(request);
      await createAuditLog({
        userId: request.user.id,
        action: 'ADMIN_ACCESSED_USER_DATA',
        resourceType: 'USER',
        resourceId: target,
        ipAddress,
        userAgent,
      });
      return; // admin bypass
    }
    const ok = await checkHierarchyAccess(request.user.id, target);
    if (!ok) return reply.status(403).send({ error: 'Not in your hierarchy' });
  };
}

module.exports = ownership;
