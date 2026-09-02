const { verifyAccessToken } = require('../utils/tokens');
const {
  isAccessTokenBlacklisted,
} = require('../config/redis');

async function authMiddleware(request, reply) {
  const auth = request.headers.authorization;

  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization' });
  }

  try {
    const token = auth.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (await isAccessTokenBlacklisted(decoded.jti)) {
      return reply.status(401).send({
        error: 'Token revoked',
      });
    }

    request.user = Object.freeze({
      id: decoded.id,
      role: decoded.role,
      departmentId: decoded.departmentId, // ✅ Added this line
      type: decoded.typ,
      jti: decoded.jti,
      exp: decoded.exp,
    });
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;