const Sentry = require('@sentry/node');
const config = require('./index');

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

      return event;
    },
  });
}

function captureException(error, context = {}) {
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

    Sentry.captureException(error);
  });
}

async function flushSentry(timeoutMs = 2000) {
  const client = Sentry.getClient();
  if (!client) return;

  await Sentry.flush(timeoutMs);
}

module.exports = { initSentry, captureException, flushSentry };
