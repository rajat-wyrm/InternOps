const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const EXEMPT = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

async function csrfCheck(request, reply) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (EXEMPT.some((p) => request.url.startsWith(p))) return;

  const headerToken = request.headers['x-csrf-token'];
  const cookieToken = request.cookies['csrf-token'];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }
}

const csrfProtection = async (fastify) => {
  fastify.addHook('onRequest', csrfCheck);
};

const csrfMiddleware = csrfCheck;

module.exports = { generateToken, csrfProtection, csrfMiddleware };
