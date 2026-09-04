const { verifyAccessToken } = require('../utils/tokens');
const {
  isAccessTokenBlacklisted,
  blacklistAccessToken,
} = require('../config/redis');
const authRepository = require('../modules/auth/repository');
const PASSWORD_CHANGE_ALLOWED_ROUTES = new Set([
  'GET /api/v1/users/me',
  'PATCH /api/v1/users/me/password',
  'POST /api/v1/auth/logout',
]);
function requestRouteKey(request) {
  const route = request.routeOptions?.url || request.routerPath || '';
  return `${request.method.toUpperCase()} ${route}`;
}

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

    const passwordState = await authRepository.getPasswordAccessState(
      decoded.id
    );
    if (!passwordState || passwordState.suspended) {
      return reply.status(401).send({ error: 'User unavailable' });
    }
    const mustChangePassword = Boolean(passwordState.must_change_password);
    request.user = Object.freeze({
      id: decoded.id,
      role: decoded.role,
      departmentId: decoded.departmentId,
      type: decoded.typ,
      jti: decoded.jti,
      exp: decoded.exp,
      mustChangePassword,
    });
    if (
      mustChangePassword &&
      !PASSWORD_CHANGE_ALLOWED_ROUTES.has(requestRouteKey(request))
    ) {
      return reply.status(403).send({
        error: 'Password change required before accessing this resource',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
