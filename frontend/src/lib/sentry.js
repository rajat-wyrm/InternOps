import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: parseFloat(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'
    ),
  });
}

export function captureException(error, context = {}) {
  if (!Sentry.getClient()) return;
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context.tags || {})) {
      scope.setTag(key, value);
    }
    for (const [key, value] of Object.entries(context.extra || {})) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}

export function setSentryUser(user) {
  if (!Sentry.getClient()) return;
  Sentry.setUser(
    user ? { id: user.id, email: user.email, role: user.role } : null
  );
}

export function clearSentryUser() {
  if (Sentry.getClient()) Sentry.setUser(null);
}
