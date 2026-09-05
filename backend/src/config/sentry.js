const Sentry = require('@sentry/node');
const config = require('./index');

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
      return event;
    },
  });
}

function captureException(error, context = {}) {
  if (!Sentry.getClient()) return;

  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: context.userId });
    for (const [key, value] of Object.entries(context.tags || {})) {
      scope.setTag(key, value);
    }
    for (const [key, value] of Object.entries(context.extra || {})) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}

async function flushSentry(timeoutMs = 2000) {
  if (!Sentry.getClient()) return;
  await Sentry.flush(timeoutMs);
}

module.exports = { initSentry, captureException, flushSentry };
