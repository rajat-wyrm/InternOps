import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBackgroundCacheInvalidation } from '../hooks/useBackgroundCacheInvalidation';

describe('GitHub Issue #2057: Stale State Synchronization (Optimistic UI Desync)', () => {
  it('subscribes, invalidates on socket mutations, and cleans up', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const listeners = {};
    const mockSocket = {
      on: vi.fn((ev, cb) => {
        listeners[ev] = cb;
      }),
      off: vi.fn((ev) => {
        delete listeners[ev];
      }),
    };
    vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { unmount } = renderHook(
      () => useBackgroundCacheInvalidation(mockSocket),
      { wrapper }
    );
    expect(mockSocket.on).toHaveBeenCalledWith(
      'database:mutation',
      expect.any(Function)
    );

    act(() => {
      listeners['database:mutation']({ type: 'rating' });
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ratings'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['teamMembers'],
    });

    act(() => {
      listeners['database:mutation']({ type: 'proof' });
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['proofs'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['tasks'],
    });

    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith(
      'database:mutation',
      expect.any(Function)
    );
  });
});
