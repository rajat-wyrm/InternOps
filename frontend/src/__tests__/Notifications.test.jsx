import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Notifications from '../pages/Notifications';
import api from '../lib/axios';

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe('Notifications Page Optimistic UI Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('immediately updates marked notification to read state in the UI (optimistic update)', async () => {
    const mockNotifications = [
      {
        id: 101,
        message: 'First unread alert',
        read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 102,
        message: 'Second unread alert',
        read: false,
        created_at: new Date().toISOString(),
      },
    ];

    api.get.mockResolvedValueOnce({
      data: {
        data: mockNotifications,
        total: 2,
        limit: 20,
        page: 1,
      },
    });

    let resolvePatch;
    const patchPromise = new Promise((resolve) => {
      resolvePatch = resolve;
    });
    api.patch.mockReturnValue(patchPromise);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Notifications />
      </QueryClientProvider>
    );

    // Wait for notifications to load
    expect(await screen.findByText('First unread alert')).toBeInTheDocument();
    expect(screen.getByText('Second unread alert')).toBeInTheDocument();

    const markReadButtons = screen.getAllByRole('button', {
      name: /mark read/i,
    });
    expect(markReadButtons).toHaveLength(2);

    // Click mark read on first notification
    fireEvent.click(markReadButtons[0]);

    // First button should be instantly removed from the DOM because the notification is updated to read
    await waitFor(() => {
      const remainingButtons = screen.queryAllByRole('button', {
        name: /mark read/i,
      });
      expect(remainingButtons).toHaveLength(1);
    });

    expect(api.patch).toHaveBeenCalledWith('/notifications/101/read');

    // Resolve patch mutation
    resolvePatch({ data: { success: true } });
  });

  it('immediately removes deleted notification from the UI (optimistic update)', async () => {
    const mockNotifications = [
      {
        id: 201,
        message: 'Delete target alert',
        read: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 202,
        message: 'Other alert',
        read: true,
        created_at: new Date().toISOString(),
      },
    ];

    api.get.mockResolvedValueOnce({
      data: {
        data: mockNotifications,
        total: 2,
        limit: 20,
        page: 1,
      },
    });

    let resolveDelete;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });
    api.delete.mockReturnValue(deletePromise);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Notifications />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Delete target alert')).toBeInTheDocument();

    const deleteButtons = screen.getAllByTitle('Delete notification');
    expect(deleteButtons).toHaveLength(2);

    // Click delete on first notification
    fireEvent.click(deleteButtons[0]);

    // First notification card should be instantly removed from the DOM
    await waitFor(() => {
      expect(screen.queryByText('Delete target alert')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Other alert')).toBeInTheDocument();
    expect(api.delete).toHaveBeenCalledWith('/notifications/201');

    resolveDelete({ data: { success: true } });
  });
});
