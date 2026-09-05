import { describe, it, expect, vi, beforeEach } from 'vitest';

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('../lib/axios', () => ({
  default: {
    post: postMock,
  },
}));

describe('reportClientError', () => {
  beforeEach(() => {
    postMock.mockReset();

    vi.stubGlobal('window', {
      location: {
        href: 'http://localhost:5173/dashboard?token=secret&user=test',
      },
    });

    vi.stubGlobal('navigator', {
      userAgent: 'test-browser',
    });
  });

  it('reports the pathname without query parameters or fragments', async () => {
    const { reportClientError } = await import('../lib/errorReporter');

    const error = new Error('Something failed');

    await reportClientError(error, {
      componentStack: 'at TestComponent',
    });

    expect(postMock).toHaveBeenCalledWith('/client-error', {
      message: 'Something failed',
      stack: error.stack,
      componentStack: 'at TestComponent',
      url: 'http://localhost:5173/dashboard',
      userAgent: 'test-browser',
      timestamp: expect.any(String),
    });
  });

  it('does not throw when error reporting fails', async () => {
    postMock.mockRejectedValueOnce(new Error('Network failure'));

    const { reportClientError } = await import('../lib/errorReporter');

    await expect(
      reportClientError(new Error('Client error'), {})
    ).resolves.toBeUndefined();
  });
});
