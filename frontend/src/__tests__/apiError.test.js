import { describe, expect, it } from 'vitest';
import { getApiErrorInfo, getApiErrorMessage } from '../lib/apiError';

describe('API error normalization', () => {
  it('prefers Fastify validation details over a generic label', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: 'Validation error',
          details: [
            { path: '/completion_date', message: 'must be YYYY-MM-DD' },
          ],
        },
      },
    };
    expect(getApiErrorMessage(error)).toBe(
      'Completion date: must be YYYY-MM-DD'
    );
  });

  it('formats a Zod path array', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: 'Validation failed',
          details: [{ path: ['rating_period_start'], message: 'Invalid date' }],
        },
      },
    };
    expect(getApiErrorMessage(error)).toBe('Rating period start: Invalid date');
  });

  it('classifies network and timeout failures', () => {
    expect(getApiErrorInfo({ code: 'ECONNABORTED' }).code).toBe(
      'REQUEST_TIMEOUT'
    );
    expect(getApiErrorInfo({ message: 'Network Error' }).code).toBe(
      'NETWORK_ERROR'
    );
  });

  it.each([
    [401, /session has expired/i],
    [403, /permission/i],
    [404, /could not be found/i],
    [409, /existing record/i],
    [413, /too large/i],
    [429, /too many requests/i],
  ])('provides a safe message for status %s', (status, expected) => {
    expect(getApiErrorMessage({ response: { status, data: {} } })).toMatch(
      expected
    );
  });

  it('keeps a safe specific operational message', () => {
    expect(
      getApiErrorMessage({
        response: {
          status: 503,
          data: { message: 'The AI service is not configured.' },
        },
      })
    ).toBe('The AI service is not configured.');
  });

  it('does not expose secret-like server text', () => {
    const message = getApiErrorMessage({
      response: {
        status: 500,
        data: {
          error: 'Internal Server Error',
          message: 'DATABASE_URL=postgresql://user:password@host/database',
          requestId: 'req-123',
        },
      },
    });
    expect(message).not.toMatch(/password|postgresql/i);
    expect(message).toMatch(/Reference: req-123/);
  });
});
