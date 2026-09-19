import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMockState = vi.hoisted(() => ({
  importCount: 0,
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => 'browserTracingIntegration'),
  captureException: vi.fn(),
  getClient: vi.fn(() => null),
  withScope: vi.fn((callback) =>
    callback({
      setTag: vi.fn(),
      setExtra: vi.fn(),
    })
  ),
  setUser: vi.fn(),
}));

function mockSentryModule(shouldThrow = false) {
  vi.doMock('@sentry/react', () => {
    sentryMockState.importCount += 1;

    if (shouldThrow) {
      throw new Error('Synthetic Sentry import failure');
    }

    return {
      init: sentryMockState.init,
      browserTracingIntegration: sentryMockState.browserTracingIntegration,
      captureException: sentryMockState.captureException,
      getClient: sentryMockState.getClient,
      withScope: sentryMockState.withScope,
      setUser: sentryMockState.setUser,
    };
  });
}

describe('sentry monitoring loader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sentryMockState.importCount = 0;
    sentryMockState.getClient.mockReturnValue(null);
    vi.stubEnv('VITE_SENTRY_DSN', '');
    vi.stubEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', '0.1');
    vi.stubEnv('MODE', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@sentry/react');
  });

  it('does not load @sentry/react until initSentry is called with a configured DSN', async () => {
    const { initSentry } = await import('../lib/sentry');

    expect(sentryMockState.importCount).toBe(0);

    await initSentry();

    expect(sentryMockState.importCount).toBe(0);
    expect(sentryMockState.init).not.toHaveBeenCalled();
  });

  it('loads the SDK once and preserves exception capture after initialization', async () => {
    vi.stubEnv(
      'VITE_SENTRY_DSN',
      'https://examplePublicKey@o0.ingest.sentry.io/0'
    );
    mockSentryModule();

    const { initSentry, captureException, setSentryUser, clearSentryUser } =
      await import('../lib/sentry');

    expect(sentryMockState.importCount).toBe(0);

    await initSentry();
    await initSentry();

    expect(sentryMockState.importCount).toBe(1);
    expect(sentryMockState.init).toHaveBeenCalledTimes(1);

    sentryMockState.getClient.mockReturnValue({});

    captureException(new Error('boom'), {
      tags: { test: 'value' },
      extra: { source: 'unit-test' },
    });
    setSentryUser({ id: 'u1', email: 'u@example.com', role: 'admin' });
    clearSentryUser();

    expect(sentryMockState.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMockState.setUser).toHaveBeenCalledTimes(2);
  });

  it('treats import failures as a failed initialization state', async () => {
    vi.stubEnv(
      'VITE_SENTRY_DSN',
      'https://examplePublicKey@o0.ingest.sentry.io/0'
    );
    mockSentryModule(true);

    const { initSentry } = await import('../lib/sentry');

    const result = await initSentry();

    expect(result).toBe(false);
    expect(sentryMockState.importCount).toBe(1);
    expect(sentryMockState.init).not.toHaveBeenCalled();
  });
});
