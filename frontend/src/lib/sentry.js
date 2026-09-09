import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
<<<<<<< HEAD

  if (!dsn) {
    return;
  }
=======
  if (!dsn) return;
>>>>>>> upstream/master

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
<<<<<<< HEAD
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: parseFloat(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'
    ),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
=======
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: parseFloat(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'
    ),
>>>>>>> upstream/master
  });
}

export function captureException(error, context = {}) {
<<<<<<< HEAD
  const client = Sentry.getClient();
  if (!client) return;

  Sentry.withScope((scope) => {
    if (context.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value);
      }
    }

    if (context.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value);
      }
    }

=======
  if (!Sentry.getClient()) return;
  Sentry.withScope((scope) => {
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

export function setSentryUser(user) {
<<<<<<< HEAD
  const client = Sentry.getClient();
  if (!client) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

export function clearSentryUser() {
  const client = Sentry.getClient();
  if (!client) return;
  Sentry.setUser(null);
=======
  if (!Sentry.getClient()) return;
  Sentry.setUser(
    user ? { id: user.id, email: user.email, role: user.role } : null
  );
}

export function clearSentryUser() {
  if (Sentry.getClient()) Sentry.setUser(null);
>>>>>>> upstream/master
}
