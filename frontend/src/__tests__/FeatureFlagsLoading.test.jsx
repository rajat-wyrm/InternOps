import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FeatureFlags from '../pages/admin/FeatureFlags';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import useFeatureFlagsStore from '../store/featureFlags';

vi.mock('../lib/axios');
vi.mock('../store/auth');
vi.mock('../store/featureFlags');

const mockFlags = [
  {
    key: 'ENABLE_BETA',
    enabled: true,
    rollout_pct: 100,
    allowed_roles: ['ADMIN'],
    description: 'Enable beta features',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
  {
    key: 'NEW_DASHBOARD',
    enabled: false,
    rollout_pct: 0,
    allowed_roles: [],
    description: 'New dashboard design',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
];

describe('FeatureFlags - Visual Refresh Loading State (#1927)', () => {
  let queryClient;
  let mockRefreshStore;

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.mockImplementation((selector) =>
      selector({
        hydrated: true,
        accessToken: 'mock-token',
        user: { role: 'ADMIN' },
      })
    );

    mockRefreshStore = vi.fn().mockResolvedValue();
    useFeatureFlagsStore.mockImplementation((selector) =>
      selector({
        refresh: mockRefreshStore,
      })
    );
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <FeatureFlags />
      </QueryClientProvider>
    );

  it('shows centered loading overlay and disables Refresh button during refresh, then dismisses on completion', async () => {
    api.get.mockResolvedValueOnce({ data: { flags: mockFlags } });

    renderComponent();

    // Verify initial flags render
    expect(await screen.findByText('ENABLE_BETA')).toBeInTheDocument();
    expect(screen.getByText('NEW_DASHBOARD')).toBeInTheDocument();

    let resolveRefresh;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    api.get.mockReturnValueOnce(refreshPromise);

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    expect(refreshButton).not.toBeDisabled();

    // Trigger refresh
    fireEvent.click(refreshButton);

    // Verify loading overlay appears immediately and shows descriptive text
    const overlay = await screen.findByTestId('feature-flags-loading-overlay');
    expect(overlay).toBeInTheDocument();
    expect(screen.getByText('Refreshing feature flags...')).toBeInTheDocument();

    // Verify Refresh button is disabled while refreshing
    expect(
      screen.getByRole('button', { name: /Refreshing.../i })
    ).toBeDisabled();

    // Resolve refresh request
    resolveRefresh({
      data: {
        flags: [
          ...mockFlags,
          {
            key: 'EXPORT_CSV',
            enabled: true,
            rollout_pct: 100,
            allowed_roles: [],
            description: 'Export CSV support',
            updated_at: '2026-09-10T00:00:00.000Z',
          },
        ],
      },
    });

    // Verify loading overlay disappears
    await waitFor(() => {
      expect(
        screen.queryByTestId('feature-flags-loading-overlay')
      ).not.toBeInTheDocument();
    });

    // Verify button is re-enabled with "Refresh"
    expect(screen.getByRole('button', { name: /Refresh/i })).not.toBeDisabled();
    expect(await screen.findByText('EXPORT_CSV')).toBeInTheDocument();
  });

  it('clears loading overlay and re-enables Refresh button even if refresh fails', async () => {
    api.get.mockResolvedValueOnce({ data: { flags: mockFlags } });

    renderComponent();
    expect(await screen.findByText('ENABLE_BETA')).toBeInTheDocument();

    let rejectRefresh;
    const refreshPromise = new Promise((_, reject) => {
      rejectRefresh = reject;
    });
    api.get.mockReturnValueOnce(refreshPromise);

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButton);

    expect(
      await screen.findByTestId('feature-flags-loading-overlay')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Refreshing.../i })
    ).toBeDisabled();

    // Reject refresh request
    rejectRefresh(new Error('Network error'));

    // Verify loading state is dismissed
    await waitFor(() => {
      expect(
        screen.queryByTestId('feature-flags-loading-overlay')
      ).not.toBeInTheDocument();
    });

    // Verify button is re-enabled
    expect(screen.getByRole('button', { name: /Refresh/i })).not.toBeDisabled();
  });

  it('prevents multiple simultaneous refresh requests while a refresh is in progress', async () => {
    api.get.mockResolvedValueOnce({ data: { flags: mockFlags } });

    renderComponent();
    expect(await screen.findByText('ENABLE_BETA')).toBeInTheDocument();

    let resolveRefresh;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    api.get.mockReturnValueOnce(refreshPromise);

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButton);

    // Initial click triggered 1 refresh call (plus the initial mount call = 2 total)
    expect(api.get).toHaveBeenCalledTimes(2);

    // Attempt second click while still in progress
    fireEvent.click(refreshButton);
    expect(api.get).toHaveBeenCalledTimes(2);

    resolveRefresh({ data: { flags: mockFlags } });

    await waitFor(() => {
      expect(
        screen.queryByTestId('feature-flags-loading-overlay')
      ).not.toBeInTheDocument();
    });
  });
});
