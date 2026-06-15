const crypto = require('crypto');
const fp = require('fastify-plugin');
const SECRET = process.env.CSRF_SECRET || require('../config').jwt.secret;

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hmac = crypto.createHmac('sha256', SECRET).update(token).digest('hex');
  return `${token}.${hmac}`;
}

function verifyToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [raw, sig] = parts;
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(raw)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

const EXEMPT = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

function csrfProtection(fastify, opts, done) {
  fastify.addHook('onRequest', async (request, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    if (EXEMPT.some((p) => request.url.startsWith(p))) return;
    const token = request.headers['x-csrf-token'];
    if (!token || !verifyToken(token)) {
      return reply.status(403).send({ error: 'CSRF token missing or invalid' });
    }
  });
  done();
}

module.exports = { generateToken, csrfProtection: fp(csrfProtection) };
