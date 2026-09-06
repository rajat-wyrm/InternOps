import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FloatingChatbot from '../components/FloatingChatbot';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

// Regression tests for issue #1795: a failed /ai/chat request must
// - be marked with `_suppressGlobalError` so the global toast handler
//   doesn't also fire a second, generic error for the same failure, and
// - show exactly one clear, differentiated message in the chat.
vi.mock('../lib/axios', async () => {
  const actual = await vi.importActual('../lib/axios');
  return {
    ...actual,
    default: {
      post: vi.fn(),
      get: vi.fn(),
    },
  };
});

vi.mock('../store/auth', () => ({
  default: vi.fn(),
}));

function setup() {
  useAuthStore.mockImplementation((selector) =>
    selector({ user: { role: 'ADMIN' } })
  );
  render(<FloatingChatbot />);
}

async function openAndSend(message) {
  // The launcher button is the only button with this title before opening.
  fireEvent.click(screen.getByLabelText('Open InternOps Assistant'));
  const input = screen.getByPlaceholderText('Ask anything about InternOps…');
  fireEvent.change(input, { target: { value: message } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('FloatingChatbot AI error handling (#1795)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the /ai/chat request so the global error toast is suppressed', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 503, data: { error: 'AI service unavailable' } },
    });

    setup();
    await openAndSend('how to enroll');

    await waitFor(() => expect(api.post).toHaveBeenCalled());

    const [url, , config] = api.post.mock.calls[0];
    expect(url).toBe('/ai/chat');
    expect(config).toMatchObject({ _suppressGlobalError: true });
  });

  it('shows exactly one error message with a Retry action for a 5xx failure', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 503, data: { error: 'AI service unavailable' } },
    });

    setup();
    await openAndSend('how to enroll');

    const errorBubbles = await screen.findAllByText(/temporarily unavailable/i);
    expect(errorBubbles).toHaveLength(1);
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows a non-retryable access message with no Retry action for a 401', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 401, data: {} },
    });

    setup();
    await openAndSend('how to enroll');

    await screen.findByText(/access/i);
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });
});
