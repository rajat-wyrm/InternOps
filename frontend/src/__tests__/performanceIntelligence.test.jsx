import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PerformanceIntelligence from '../pages/PerformanceIntelligence';
import api from '../lib/axios';

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    isCancel: vi.fn(
      (err) => err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED'
    ),
  },
  getApiErrorMessage: vi.fn(() => 'API Error'),
}));

vi.mock('../components/loading/RouteInitialLoading', () => ({
  useRouteInitialLoading: vi.fn(),
}));

describe('GitHub Issue #2068: PerformanceIntelligence async cancellation and cleanup', () => {
  const mockInterns = [
    { id: 'intern-1', full_name: 'Alice Johnson', email: 'alice@example.com' },
    { id: 'intern-2', full_name: 'Bob Smith', email: 'bob@example.com' },
  ];

  const mockReview1 = {
    id: 'rev-1',
    intern_id: 'intern-1',
    overall_score: 85.0,
    performance_level: 'Exemplary',
    confidence: 0.95,
    status: 'completed',
    summary: 'Outstanding technical performance',
    score_breakdown: {
      task_execution: 90,
      task_quality: 85,
      timeliness: 80,
      technical_quality: 85,
      code_quality: 85,
    },
    recommendations: [],
    trend_metrics: [],
  };

  const mockReview2 = {
    id: 'rev-2',
    intern_id: 'intern-2',
    overall_score: 92.0,
    performance_level: 'Exemplary',
    confidence: 0.98,
    status: 'completed',
    summary: 'Top tier contributor',
    score_breakdown: {
      task_execution: 95,
      task_quality: 90,
      timeliness: 90,
      technical_quality: 92,
      code_quality: 93,
    },
    recommendations: [],
    trend_metrics: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'mgr-1', role: 'ADMIN', full_name: 'Admin Manager' })
    );
  });

  it('passes AbortSignal to API calls on initial load', async () => {
    api.get.mockImplementation((url, config) => {
      if (url.includes('/team/members')) {
        expect(config?.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve({ data: mockInterns });
      }
      if (url.includes('/ai/performance/intern-1/history')) {
        expect(config?.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve({ data: { history: [] } });
      }
      if (url.includes('/ai/performance/intern-1')) {
        expect(config?.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve({ data: mockReview1 });
      }
      return Promise.resolve({ data: {} });
    });

    render(<PerformanceIntelligence />);

    await waitFor(() => {
      expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
    });
  });

  it('aborts previous in-flight request when intern selection changes', async () => {
    let intern1Signal;
    let intern2Signal;

    api.get.mockImplementation((url, config) => {
      if (url.includes('/team/members')) {
        return Promise.resolve({ data: mockInterns });
      }
      if (url === '/ai/performance/intern-1') {
        intern1Signal = config?.signal;
        // Keep promise unresolved to simulate slow request
        return new Promise(() => {});
      }
      if (url === '/ai/performance/intern-1/history') {
        return new Promise(() => {});
      }
      if (url === '/ai/performance/intern-2') {
        intern2Signal = config?.signal;
        return Promise.resolve({ data: mockReview2 });
      }
      if (url === '/ai/performance/intern-2/history') {
        return Promise.resolve({ data: { history: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<PerformanceIntelligence />);

    await waitFor(() => {
      expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
      expect(intern1Signal).toBeDefined();
    });

    expect(intern1Signal.aborted).toBe(false);

    // Switch intern to intern-2
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'intern-2' } });

    await waitFor(() => {
      expect(intern1Signal.aborted).toBe(true);
    });

    expect(intern2Signal).toBeDefined();
    expect(intern2Signal.aborted).toBe(false);
  });

  it('aborts active requests on component unmount without setting state', async () => {
    let capturedSignal;

    api.get.mockImplementation((url, config) => {
      if (url.includes('/team/members')) {
        return Promise.resolve({ data: mockInterns });
      }
      if (url.includes('/ai/performance/intern-1')) {
        capturedSignal = config?.signal;
        return new Promise(() => {});
      }
      return Promise.resolve({ data: {} });
    });

    const { unmount } = render(<PerformanceIntelligence />);

    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });

    expect(capturedSignal.aborted).toBe(false);

    unmount();

    expect(capturedSignal.aborted).toBe(true);
  });

  it('safely handles aborted/canceled errors without triggering fallback mock model or warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    api.get.mockImplementation((url, config) => {
      if (url.includes('/team/members')) {
        return Promise.resolve({ data: mockInterns });
      }
      if (url.includes('/ai/performance/intern-1')) {
        const cancelErr = new Error('canceled');
        cancelErr.name = 'CanceledError';
        cancelErr.code = 'ERR_CANCELED';
        return Promise.reject(cancelErr);
      }
      return Promise.resolve({ data: {} });
    });

    render(<PerformanceIntelligence />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/team/members'),
        expect.anything()
      );
    });

    // Verify warning for offline fallback was NOT called for canceled errors
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'API connection offline, rendering local evidence model'
      )
    );

    warnSpy.mockRestore();
  });
});
