const Sentry = require('@sentry/node');
const config = require('./index');

<<<<<<< HEAD
function initSentry() {
  const dsn = config.sentry.dsn;

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: config.nodeEnv || 'development',
    tracesSampleRate: config.sentry.tracesSampleRate,

    beforeSend(event) {
      if (event.request && event.request.data) {
        const data = event.request.data;
        const sensitiveKeys = [
          'password',
          'currentPassword',
          'newPassword',
          'confirmPassword',
          'token',
          'refreshToken',
          'accessToken',
          'secret',
          'apiKey',
          'authorization',
        ];

        for (const key of sensitiveKeys) {
          if (typeof data === 'object' && data !== null && key in data) {
            data[key] = '[REDACTED]';
          }
        }
      }

      if (event.request && event.request.headers) {
        if (event.request.headers.authorization) {
          event.request.headers.authorization = '[REDACTED]';
        }
        if (event.request.headers.cookie) {
          event.request.headers.cookie = '[REDACTED]';
        }
      }

=======
const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'apikey',
  'authorization',
]);

function redactSensitiveData(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);

  for (const key of Object.keys(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      value[key] = '[REDACTED]';
    } else {
      redactSensitiveData(value[key], seen);
    }
  }
  return value;
}

function initSentry() {
  if (!config.sentry.dsn) return;

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.nodeEnv || 'development',
    tracesSampleRate: config.sentry.tracesSampleRate,
    beforeSend(event) {
      if (event.request?.data) redactSensitiveData(event.request.data);
      if (event.request?.headers) redactSensitiveData(event.request.headers);
>>>>>>> upstream/master
      return event;
    },
  });
}

function captureException(error, context = {}) {
<<<<<<< HEAD
  const client = Sentry.getClient();
  if (!client) return;

  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.requestId) scope.setTag('requestId', context.requestId);
    if (context.route) scope.setTag('route', context.route);
    if (context.method) scope.setTag('method', context.method);
    if (context.statusCode)
      scope.setTag('statusCode', String(context.statusCode));

    if (context.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value);
      }
    }

=======
  if (!Sentry.getClient()) return;

  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: context.userId });
    for (const [key, value] of Object.entries(context.tags || {})) {
      scope.setTag(key, value);
    }
    for (const [key, value] of Object.entries(context.extra || {})) {
      scope.setExtra(key, value);
    }
>>>>>>> upstream/master
    Sentry.captureException(error);
  });
}

async function flushSentry(timeoutMs = 2000) {
<<<<<<< HEAD
  const client = Sentry.getClient();
  if (!client) return;

=======
  if (!Sentry.getClient()) return;
>>>>>>> upstream/master
  await Sentry.flush(timeoutMs);
}

module.exports = { initSentry, captureException, flushSentry };
