import { describe, it, expect } from 'vitest';
import { getAiChatErrorMessage } from '../lib/axios';

// Regression tests for issue #1795: the AI assistant must show exactly one
// clear, differentiated error message per failure type instead of a single
// generic "temporarily unavailable" message for everything.
describe('getAiChatErrorMessage', () => {
  it('returns a retryable timeout message for aborted/timed-out requests', () => {
    const err = { code: 'ECONNABORTED' };
    const result = getAiChatErrorMessage(err);
    expect(result.message).toMatch(/too long/i);
    expect(result.retryable).toBe(true);
  });

  it('returns a retryable network message when there is no response at all', () => {
    const err = { message: 'Network Error' };
    const result = getAiChatErrorMessage(err);
    expect(result.message).toMatch(/unable to reach/i);
    expect(result.retryable).toBe(true);
  });

  it('returns a non-retryable access message for 401', () => {
    const err = { response: { status: 401, data: {} } };
    const result = getAiChatErrorMessage(err);
    expect(result.message).toMatch(/access/i);
    expect(result.retryable).toBe(false);
  });

  it('returns a non-retryable access message for 403', () => {
    const err = { response: { status: 403, data: {} } };
    const result = getAiChatErrorMessage(err);
    expect(result.message).toMatch(/access/i);
    expect(result.retryable).toBe(false);
  });

  it('returns a non-retryable rate-limit message for 429, preferring the server message', () => {
    const err = {
      response: {
        status: 429,
        data: { error: 'Daily AI usage limit exceeded' },
      },
    };
    const result = getAiChatErrorMessage(err);
    expect(result.message).toBe('Daily AI usage limit exceeded');
    expect(result.retryable).toBe(false);
  });

  it('falls back to a generic rate-limit message for 429 with no server message', () => {
    const err = { response: { status: 429, data: {} } };
    const result = getAiChatErrorMessage(err);
    expect(result.message).toMatch(/usage limit/i);
    expect(result.retryable).toBe(false);
  });

  it('returns a retryable outage message for 5xx (provider/backend failure)', () => {
    const err = {
      response: { status: 503, data: { error: 'AI service unavailable' } },
    };
    const result = getAiChatErrorMessage(err);
    expect(result.message).toMatch(/temporarily unavailable/i);
    expect(result.retryable).toBe(true);
  });

  it('does not leak backend/provider error details for 5xx', () => {
    const err = {
      response: {
        status: 503,
        data: {
          error: 'gemini failed with status 401: invalid api key xyz123',
        },
      },
    };
    const result = getAiChatErrorMessage(err);
    expect(result.message).not.toMatch(/xyz123/);
    expect(result.message).not.toMatch(/gemini/i);
  });

  it('surfaces a non-retryable server-provided message for other 4xx errors', () => {
    const err = {
      response: {
        status: 400,
        data: { error: 'Message content cannot be empty' },
      },
    };
    const result = getAiChatErrorMessage(err);
    expect(result.message).toBe('Message content cannot be empty');
    expect(result.retryable).toBe(false);
  });
});
