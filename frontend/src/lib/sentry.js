let Sentry = null;
let initPromise = null;
let initState = 'idle';
let pendingOperations = [];

function getDsn() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  return dsn?.trim() ? dsn : null;
}

async function loadSentry() {
  if (Sentry) return Sentry;

  Sentry = await import('@sentry/react');
  return Sentry;
}

function flushPendingOperations() {
  if (!Sentry || !Sentry.getClient()) return;

  const queued = pendingOperations;
  pendingOperations = [];

  queued.forEach((operation) => operation());
}

function queueOperation(operation) {
  pendingOperations.push(operation);
}

function getSentryClient() {
  return Sentry?.getClient?.() || null;
}

export async function initSentry() {
  const dsn = getDsn();

  if (!dsn) {
    initState = 'disabled';
    return false;
  }

  if (initState === 'ready') return true;
  if (initState === 'loading') return initPromise;
  if (initState === 'failed') return false;

  initState = 'loading';

  initPromise = (async () => {
    try {
      const sentry = await loadSentry();

      sentry.init({
        dsn,
        environment: import.meta.env.MODE || 'development',
        integrations: [sentry.browserTracingIntegration()],
        tracesSampleRate: parseFloat(
          import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'
        ),
      });

      initState = 'ready';
      flushPendingOperations();
      return true;
    } catch (error) {
      console.error('[sentry] Failed to initialize monitoring', error);
      initState = 'failed';
      pendingOperations = [];
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

function performCaptureException(error, context = {}) {
  if (!Sentry || !getSentryClient()) return;

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

export function captureException(error, context = {}) {
  if (!getDsn()) return;

  if (initState === 'ready') {
    performCaptureException(error, context);
    return;
  }

  if (initState === 'loading') {
    // Policy: while initialization is in flight, early errors are buffered
    // so startup failures can still be reported once monitoring is ready.
    queueOperation(() => performCaptureException(error, context));
    return;
  }

  if (initState === 'failed') {
    return;
  }

  queueOperation(() => performCaptureException(error, context));
}

function performSetSentryUser(user) {
  if (!Sentry || !getSentryClient()) return;

  Sentry.setUser(
    user ? { id: user.id, email: user.email, role: user.role } : null
  );
}

export function setSentryUser(user) {
  if (!getDsn()) return;

  if (initState === 'ready') {
    performSetSentryUser(user);
    return;
  }

  if (initState === 'loading') {
    queueOperation(() => performSetSentryUser(user));
    return;
  }

  if (initState === 'failed') {
    return;
  }

  queueOperation(() => performSetSentryUser(user));
}

function performClearSentryUser() {
  if (!Sentry || !getSentryClient()) return;
  Sentry.setUser(null);
}

export function clearSentryUser() {
  if (!getDsn()) return;

  if (initState === 'ready') {
    performClearSentryUser();
    return;
  }

  if (initState === 'loading') {
    queueOperation(() => performClearSentryUser());
    return;
  }

  if (initState === 'failed') {
    return;
  }

  queueOperation(() => performClearSentryUser());
}
