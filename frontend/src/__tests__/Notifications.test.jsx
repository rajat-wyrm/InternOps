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

describe('Notifications Page Row Action Pending States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables only the active notification row action button while request is pending', async () => {
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
    expect(markReadButtons[0]).not.toBeDisabled();
    expect(markReadButtons[1]).not.toBeDisabled();

    // Click mark read on first notification
    fireEvent.click(markReadButtons[0]);

    // First button should be disabled and show loading state
    await waitFor(() => {
      expect(screen.getByText('Marking...')).toBeInTheDocument();
    });

    const pendingButton = screen.getByRole('button', {
      name: /marking\.\.\./i,
    });
    expect(pendingButton).toBeDisabled();

    // Second button should STILL be enabled
    const remainingMarkReadButtons = screen.getAllByRole('button', {
      name: /mark read/i,
    });
    expect(remainingMarkReadButtons).toHaveLength(1);
    expect(remainingMarkReadButtons[0]).not.toBeDisabled();

    // Resolve patch mutation
    resolvePatch({ data: { success: true } });
  });

  it('disables only the active notification delete button while delete request is pending', async () => {
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

    // First delete button should be disabled
    await waitFor(() => {
      expect(deleteButtons[0]).toBeDisabled();
    });

    // Second delete button should remain enabled
    expect(deleteButtons[1]).not.toBeDisabled();

    resolveDelete({ data: { success: true } });
  });
});
