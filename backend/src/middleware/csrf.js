const crypto = require('crypto');
const config = require('../config');
const { verifyAccessToken } = require('../utils/tokens');
const SESSION_COOKIE = 'csrf-sid';
const TOKEN_COOKIE = 'csrf-token';
const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

function getSecret() {
  const secret = config.jwt?.secret;
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

function logCsrfWarn(request, details, message) {
  request.log?.warn(details, message);
}

function normalizeOrigin(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function getTrustedOrigins() {
  const origins = [];

  const addValue = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(addValue);
    } else if (typeof val === 'string') {
      if (val.includes(',')) {
        val.split(',').forEach((v) => addValue(v.trim()));
      } else {
        const normalized = normalizeOrigin(val);
        if (normalized && normalized !== '*') {
          origins.push(normalized);
        }
      }
    }
  };

  addValue(config.corsOrigin);
  addValue(config.appUrl);

  return [...new Set(origins)];
}

function isTrustedRequestOrigin(request) {
  const originHeader = request.headers?.origin;
  const refererHeader = request.headers?.referer;
  const candidates = [originHeader, refererHeader].filter(Boolean);

  if (!candidates.length) {
    return false;
  }

  const trustedOrigins = new Set(getTrustedOrigins());
  const isDev = config.nodeEnv !== 'production';

  return candidates.some((candidate) => {
    const normalized = normalizeOrigin(candidate);
    if (!normalized) return false;

    if (trustedOrigins.has(normalized)) {
      return true;
    }

    if (isDev) {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)) {
        return true;
      }
    }

    return false;
  });
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
    maxAge: ONE_DAY_IN_SECONDS, // 24 hours
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
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: ONE_DAY_IN_SECONDS, // 24 hours
  });

  return csrfToken;
}

function getOrCreateToken(request, reply) {
  let session = readSession(request);

  let tokenUserId = null;
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const authToken = authHeader.split(' ')[1];
    try {
      const decoded = verifyAccessToken(authToken);
      tokenUserId = decoded.id;
    } catch (err) {
      logCsrfWarn(
        request,
        {
          err,
          method: request.method,
          url: request.url,
          hasAuthHeader: true,
          tokenLength: authToken ? authToken.length : 0,
        },
        'CSRF bearer token verification failed while generating CSRF token'
      );
    }
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
  const token = getOrCreateToken(request, reply);
  reply.setCookie('csrf-token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: ONE_DAY_IN_SECONDS,
  });

  return token;
}

const EXEMPT = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/docs',
  '/docs/json',
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

  const hasBearerAuth = Boolean(
    request.headers.authorization &&
    request.headers.authorization.startsWith('Bearer ')
  );
  let hasValidBearerAuth = false;
  let decodedBearerToken = null;

  if (hasBearerAuth) {
    const authHeader = request.headers.authorization;
    const authToken = authHeader.split(' ')[1];
    try {
      decodedBearerToken = verifyAccessToken(authToken);
      hasValidBearerAuth = true;
    } catch (err) {
      logCsrfWarn(
        request,
        {
          err,
          method: request.method,
          url: request.url,
          hasAuthHeader: true,
          tokenLength: authToken ? authToken.length : 0,
        },
        'CSRF bearer token verification failed during request validation'
      );
    }
  }

  const hasSession = Boolean(session && session.sid);

  if (!hasSession && hasValidBearerAuth) {
    return;
  }

  if (!isTrustedRequestOrigin(request)) {
    logCsrfWarn(
      request,
      {
        method: request.method,
        url: request.url,
        origin: request.headers?.origin || null,
        referer: request.headers?.referer || null,
      },
      'CSRF origin validation failed'
    );
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }

  const headerToken = request.headers['x-csrf-token'];

  if (!session || !session.sid || !headerToken) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }

  // --- Secure Timing-Safe Comparison Fix ---
  const expectedToken = tokenFor(session.sid);

  if (expectedToken.length !== headerToken.length) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }

  const expectedBuffer = Buffer.from(expectedToken);
  const headerBuffer = Buffer.from(headerToken);

  if (!crypto.timingSafeEqual(expectedBuffer, headerBuffer)) {
    return reply.status(403).send({ error: 'CSRF validation failed' });
  }
  // -----------------------------------------

  let tokenUserId = null;
  if (request.user && request.user.id) {
    tokenUserId = request.user.id;
  } else if (hasValidBearerAuth && decodedBearerToken) {
    tokenUserId = decodedBearerToken.id;
  }

  if (tokenUserId) {
    if (session.userId !== String(tokenUserId)) {
      return reply.status(403).send({ error: 'CSRF validation failed' });
    }
  }
}

const csrfProtection = async (fastify) => {
  fastify.addHook('preHandler', csrfCheck);
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
