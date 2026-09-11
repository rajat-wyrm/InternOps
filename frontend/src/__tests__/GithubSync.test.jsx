import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('../lib/axios', () => ({
  default: {
    get: mockApiGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getBaseUrl: vi.fn(() => '/api/v1'),
}));

vi.mock('../store/auth', () => ({
  default: (selector) =>
    selector({
      accessToken: 'test-token',
      hydrated: true,
    }),
}));

vi.mock('recharts', () => {
  const Mock = ({ children }) => <div>{children}</div>;
  return {
    LineChart: Mock,
    Line: Mock,
    BarChart: Mock,
    Bar: Mock,
    PieChart: Mock,
    Pie: Mock,
    Cell: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    Legend: Mock,
    ResponsiveContainer: Mock,
    AreaChart: Mock,
    Area: Mock,
  };
});

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="mock-icon" />;

  return {
    GitPullRequest: Icon,
    RefreshCw: Icon,
    CheckCircle: Icon,
    XCircle: Icon,
    AlertTriangle: Icon,
    Clock: Icon,
    Copy: Icon,
    Settings: Icon,
    Activity: Icon,
    List: Icon,
    BarChart3: Icon,
    Shield: Icon,
    Globe: Icon,
    Terminal: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Trash2: Icon,
    ExternalLink: Icon,
    Server: Icon,
    Zap: Icon,
    Wifi: Icon,
    WifiOff: Icon,
    BugPlay: Icon,
    Gauge: Icon,
    HardDrive: Icon,
    RotateCcw: Icon,
    TrendingUp: Icon,
    PieChart: Icon,
    Calendar: Icon,
  };
});

import GithubSync from '../pages/admin/GithubSync';

describe('GithubSync request cancellation', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    mockApiGet.mockImplementation((url) => {
      if (url.includes('/github/status')) {
        return Promise.resolve({ data: {} });
      }

      if (url.includes('/github/orchestrator')) {
        return Promise.resolve({ data: {} });
      }

      if (url.includes('/github/rate-limit')) {
        return Promise.resolve({ data: {} });
      }

      if (url.includes('/github/logs')) {
        return Promise.resolve({ data: [] });
      }

      if (url.includes('/github/stats/count')) {
        return Promise.resolve({ data: {} });
      }

      if (url.includes('/github/settings')) {
        return Promise.resolve({ data: {} });
      }

      if (url.includes('/github/issues')) {
        return Promise.resolve({ data: [] });
      }

      if (url.includes('/github/stats/analytics')) {
        return Promise.resolve({ data: {} });
      }

      return Promise.resolve({ data: {} });
    });
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <GithubSync />
      </QueryClientProvider>
    );

  it('passes an AbortSignal to the issues request', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /issues/i }));

    await waitFor(() => {
      const issuesCall = mockApiGet.mock.calls.find(([url]) =>
        url.includes('/github/issues')
      );

      expect(issuesCall).toBeTruthy();
      expect(issuesCall[1]).toEqual(
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  it('passes an AbortSignal to the analytics request', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /analytics/i }));

    await waitFor(() => {
      const analyticsCall = mockApiGet.mock.calls.find(([url]) =>
        url.includes('/github/stats/analytics')
      );

      expect(analyticsCall).toBeTruthy();
      expect(analyticsCall[1]).toEqual(
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });
});
