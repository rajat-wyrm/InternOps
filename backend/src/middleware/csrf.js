const crypto = require('crypto');

// In-memory store of CSRF tokens keyed by a server-issued session id.
// The session id is delivered to the client in a signed (HMAC) cookie so
// it cannot be forged; the token is the HMAC of the session id, which
// makes it deterministic and stable across calls. This fixes the issue
// where each GET /api/auth/csrf-token call generated a fresh token and
// overwrote the cookie, breaking subsequent mutation requests that
// still held the previous token (#138).
const SESSION_COOKIE = 'csrf-sid';
const TOKEN_COOKIE = 'csrf-token';

function getSecret() {
  // Re-use the JWT secret so a misconfigured deployment fails the
  // existing validateEnv() check at boot. The CSRF secret is only
  // used to sign the session id cookie; if it leaks, an attacker can
  // mint CSRF session ids but cannot authenticate requests.
  const secret = require('../config').jwt?.secret;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured; cannot sign CSRF session');
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
}

function verifySigned(value, signature) {
  if (!value || !signature) return false;
  const expected = sign(value);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function newSessionId() {
  return crypto.randomBytes(24).toString('hex');
}

function tokenFor(sessionId) {
  return sign(`csrf:${sessionId}`);
}

function readSession(request) {
  const cookies = parseCookies(request.headers.cookie);
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;
  const [sid, sig] = raw.split('.');
  if (!sid || !sig) return null;
  if (!verifySigned(sid, sig)) return null;
  return sid;
}

function writeSession(reply, sessionId) {
  const signed = `${sessionId}.${sign(sessionId)}`;
  reply.setCookie(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

function getOrCreateToken(request, reply) {
  let sid = readSession(request);
  if (!sid) {
    sid = newSessionId();
    writeSession(reply, sid);
  }
  return tokenFor(sid);
}

function generateToken(request, reply) {
  return getOrCreateToken(request, reply);
}

const EXEMPT = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

async function csrfCheck(request, reply) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (!request.url) return;

  const path =
    request.routerPath ??
    request.routeOptions?.url ??
    request.url.split('?')[0].split('#')[0];
  if (EXEMPT.includes(path)) return;

  const sid = readSession(request);
  const headerToken = request.headers['x-csrf-token'];

  if (!sid || !headerToken) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }

  // The expected token is derived from the signed session id, so we
  // don't need to keep anything in memory. A request with a valid
  // session cookie and the matching header passes; anything else fails.
  if (headerToken !== tokenFor(sid)) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }
}

const csrfProtection = async (fastify) => {
  fastify.addHook('onRequest', csrfCheck);
};

const csrfMiddleware = csrfCheck;

module.exports = {
  generateToken,
  csrfProtection,
  csrfMiddleware,
  // exported for tests
  _internal: { tokenFor, verifySigned, readSession, writeSession },
};
