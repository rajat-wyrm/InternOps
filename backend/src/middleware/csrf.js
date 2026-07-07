const crypto = require('crypto');

const SESSION_COOKIE = 'csrf-sid';
const TOKEN_COOKIE = 'csrf-token';

function getSecret() {
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

function rotateSession(reply) {
  const sid = newSessionId();
  writeSession(reply, sid);
  return tokenFor(sid);
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
  } else if (
    tokenUserId &&
    String(session.userId || '') !== String(tokenUserId)
  ) {
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
  const session = readSession(request);
  if (session) {
    request.session = session;
  }

  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (!request.url) return;

  const path =
    request.routerPath ??
    request.routeOptions?.url ??
    request.url.split('?')[0].split('#')[0];
  if (EXEMPT.includes(path)) return;

  const headerToken = request.headers['x-csrf-token'];

  if (!session || !session.sid || !headerToken) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }

  if (headerToken !== tokenFor(session.sid)) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }

  let tokenUserId = null;
  if (request.user && request.user.id) {
    tokenUserId = request.user.id;
  } else {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyAccessToken } = require('../utils/tokens');
        const decoded = verifyAccessToken(authHeader.split(' ')[1]);
        tokenUserId = decoded.id;
      } catch (err) {}
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
  rotateSession,
  csrfProtection,
  csrfMiddleware,
  rotateAndSetCsrf,
  _internal: { tokenFor, verifySigned, readSession, writeSession },
};
