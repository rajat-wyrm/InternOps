const { verifyAccessToken } = require('../utils/tokens');
const {
  isAccessTokenBlacklisted,
  blacklistAccessToken,
} = require('../config/redis');

async function authMiddleware(request, reply) {
  const auth = request.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization' });
  }

  try {
    const decoded = verifyAccessToken(auth.split(' ')[1]);

    if (await isAccessTokenBlacklisted(decoded.jti)) {
      return reply.status(401).send({
        error: 'Token revoked',
      });
    }

    request.user = Object.freeze({
      id: decoded.id,
      role: decoded.role,
      departmentId: decoded.departmentId,
      type: decoded.typ,
      jti: decoded.jti,
      exp: decoded.exp,
    });
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
