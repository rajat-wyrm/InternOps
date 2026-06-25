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
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  if (!verifySigned(payload, sig)) return null;

  const colonIdx = payload.indexOf(':');
  if (colonIdx === -1) {
    return { sid: payload, userId: null };
  }
  const sid = payload.slice(0, colonIdx);
  const userId = payload.slice(colonIdx + 1);
  return { sid, userId: userId || null };
}

function writeSession(reply, sessionId, userId = null) {
  const payload = userId ? `${sessionId}:${userId}` : `${sessionId}:`;
  const signed = `${payload}.${sign(payload)}`;
  reply.setCookie(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

function rotateAndSetCsrf(request, reply, userId = null) {
  const newSid = newSessionId();
  writeSession(reply, newSid, userId);
  const csrfToken = tokenFor(newSid);

  reply.setCookie(TOKEN_COOKIE, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  return csrfToken;
}

function getOrCreateToken(request, reply) {
  let session = readSession(request);

  // Extract authenticated user ID from Authorization header
  let tokenUserId = null;
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { verifyAccessToken } = require('../utils/tokens');
      const decoded = verifyAccessToken(authHeader.split(' ')[1]);
      tokenUserId = decoded.id;
    } catch (err) {}
  }

  if (!session) {
    const sid = newSessionId();
    writeSession(reply, sid, tokenUserId);
    session = { sid, userId: tokenUserId };
  } else if (tokenUserId && session.userId !== String(tokenUserId)) {
    const sid = newSessionId();
    writeSession(reply, sid, tokenUserId);
    session = { sid, userId: tokenUserId };
  }
  return tokenFor(session.sid);
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

  const session = readSession(request);
  const headerToken = request.headers['x-csrf-token'];

  if (!session || !session.sid || !headerToken) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }

  if (headerToken !== tokenFor(session.sid)) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }

  // Extract authenticated user ID from Authorization header
  let tokenUserId = null;
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { verifyAccessToken } = require('../utils/tokens');
      const decoded = verifyAccessToken(authHeader.split(' ')[1]);
      tokenUserId = decoded.id;
    } catch (err) {
      // Ignore token verification errors, request authentication will be checked in auth middleware.
    }
  }

  if (tokenUserId) {
    if (session.userId !== String(tokenUserId)) {
      return reply.status(403).send({ error: 'CSRF validation failed' });
    }
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
  rotateAndSetCsrf,
  // exported for tests
  _internal: { tokenFor, verifySigned, readSession, writeSession },
};
