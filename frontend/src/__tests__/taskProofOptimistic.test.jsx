import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Tasks from '../pages/Tasks';
import TaskDetails from '../pages/admin/TaskDetails';
import ErrorBoundary from '../components/ErrorBoundary';
import api from '../lib/axios';
import useAuthStore from '../store/auth';
import { toast } from 'sonner';

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  registerAuthStore: vi.fn(),
}));

vi.mock('../store/auth');

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

describe('GitHub Issue #1964: Task Proof Optimistic UI Updates & Failure Cascades', () => {
  const mockUser = {
    id: 'sup-1',
    full_name: 'Lead Supervisor',
    email: 'supervisor@uptoskill.com',
    role: 'TL',
  };

  const mockAdminUser = {
    id: 'admin-1',
    full_name: 'Admin Supervisor',
    email: 'admin@uptoskill.com',
    role: 'ADMIN',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.mockImplementation((selector) => {
      const state = {
        hydrated: true,
        accessToken: 'mock-token',
        user: mockUser,
      };
      return typeof selector === 'function' ? selector(state) : state;
    });
  });

  describe('Tasks Page Optimistic Updates & Activity Logs', () => {
    const mockTasks = [
      {
        id: 42,
        title: 'Complete Onboarding Checklist',
        platform: 'LinkedIn',
        points: 100,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        department_id: 'dept-1',
        department_name: 'Engineering',
        submission_count: 1,
      },
    ];

    const mockProofs = [
      {
        id: 88,
        task_id: 42,
        intern_id: 99,
        intern_name: 'John Intern',
        intern_email: 'john@example.com',
        status: 'PENDING',
        created_at: new Date('2026-03-01T10:00:00Z').toISOString(),
        images: [{ id: 1, image_path: 'uploads/proof1.png' }],
        did_comment: true,
        did_repost: false,
        did_share: false,
      },
    ];

    it('optimistically approves proof: immediately updates status badge and adds activity log before backend responds', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/tasks') {
          return Promise.resolve({ data: mockTasks });
        }
        if (url === '/proofs/task/42') {
          return Promise.resolve({ data: mockProofs });
        }
        if (url === '/departments') {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error(`Unhandled GET: ${url}`));
      });

      let resolvePatch;
      const patchPromise = new Promise((resolve) => {
        resolvePatch = resolve;
      });
      api.patch.mockReturnValue(patchPromise);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tasks']}>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify task loaded
      expect(
        await screen.findByText('Complete Onboarding Checklist')
      ).toBeInTheDocument();

      // Click "View proofs"
      const viewProofsBtn = screen.getByRole('button', {
        name: /view proofs/i,
      });
      fireEvent.click(viewProofsBtn);

      // Verify initial proof status is PENDING
      expect(await screen.findByText('PENDING')).toBeInTheDocument();
      expect(screen.getByText('Intern: John Intern')).toBeInTheDocument();

      // Find Approve button
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      expect(approveBtn).toBeInTheDocument();

      // Click Approve
      fireEvent.click(approveBtn);

      // OPTIMISTIC ASSERTION: Proof status immediately shifts to APPROVED without waiting for network
      await waitFor(() => {
        expect(screen.getByText('APPROVED')).toBeInTheDocument();
        expect(screen.queryByText('PENDING')).not.toBeInTheDocument();
      });

      // OPTIMISTIC ASSERTION: Activity log shows immediate approved entry
      const logContainer = screen.getByTestId('activity-logs-88');
      expect(logContainer).toHaveTextContent(
        'Proof approved by Lead Supervisor'
      );

      // Backend API was called with the correct endpoint
      expect(api.patch).toHaveBeenCalledWith('/proofs/88/verify');

      // Now resolve backend network promise
      resolvePatch({ data: { message: 'Proof verified successfully' } });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/approved/i)
        );
      });

      // Final status remains APPROVED
      expect(screen.getByText('APPROVED')).toBeInTheDocument();
    });

    it('optimistically rejects proof: immediately updates status badge and adds activity log before backend responds', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/tasks') {
          return Promise.resolve({ data: mockTasks });
        }
        if (url === '/proofs/task/42') {
          return Promise.resolve({ data: mockProofs });
        }
        if (url === '/departments') {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error(`Unhandled GET: ${url}`));
      });

      let resolvePatch;
      const patchPromise = new Promise((resolve) => {
        resolvePatch = resolve;
      });
      api.patch.mockReturnValue(patchPromise);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tasks']}>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(
        await screen.findByText('Complete Onboarding Checklist')
      ).toBeInTheDocument();

      const viewProofsBtn = screen.getByRole('button', {
        name: /view proofs/i,
      });
      fireEvent.click(viewProofsBtn);

      expect(await screen.findByText('PENDING')).toBeInTheDocument();

      const rejectBtn = screen.getByRole('button', { name: /reject/i });
      expect(rejectBtn).toBeInTheDocument();

      // Click Reject
      fireEvent.click(rejectBtn);

      // OPTIMISTIC ASSERTION: Proof status immediately shifts to REJECTED
      await waitFor(() => {
        expect(screen.getByText('REJECTED')).toBeInTheDocument();
        expect(screen.queryByText('PENDING')).not.toBeInTheDocument();
      });

      // OPTIMISTIC ASSERTION: Activity log shows immediate rejected entry
      const logContainer = screen.getByTestId('activity-logs-88');
      expect(logContainer).toHaveTextContent(
        'Proof rejected by Lead Supervisor'
      );

      // Verify correct endpoint was invoked
      expect(api.patch).toHaveBeenCalledWith('/proofs/88/reject');

      resolvePatch({ data: { message: 'Proof rejected successfully' } });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/rejected/i)
        );
      });

      expect(screen.getByText('REJECTED')).toBeInTheDocument();
    });

    it('rolls back optimistic changes upon backend 403 hierarchy permission failure and shows error notification', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/tasks') {
          return Promise.resolve({ data: mockTasks });
        }
        if (url === '/proofs/task/42') {
          return Promise.resolve({ data: mockProofs });
        }
        if (url === '/departments') {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error(`Unhandled GET: ${url}`));
      });

      let rejectPatch;
      const patchPromise = new Promise((_, reject) => {
        rejectPatch = reject;
      });
      api.patch.mockReturnValue(patchPromise);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tasks']}>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(
        await screen.findByText('Complete Onboarding Checklist')
      ).toBeInTheDocument();

      const viewProofsBtn = screen.getByRole('button', {
        name: /view proofs/i,
      });
      fireEvent.click(viewProofsBtn);

      expect(await screen.findByText('PENDING')).toBeInTheDocument();

      const approveBtn = screen.getByRole('button', { name: /approve/i });
      fireEvent.click(approveBtn);

      // Optimistically shows APPROVED
      await waitFor(() => {
        expect(screen.getByText('APPROVED')).toBeInTheDocument();
      });

      // Backend fails with 403 Forbidden hierarchy check error
      const forbiddenError = {
        response: {
          status: 403,
          data: {
            error:
              'Forbidden: You can only review proofs submitted by interns in your team hierarchy',
          },
        },
      };
      rejectPatch(forbiddenError);

      // ROLLBACK ASSERTION: Status reverts back to PENDING
      await waitFor(() => {
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        expect(screen.queryByText('APPROVED')).not.toBeInTheDocument();
      });

      // ROLLBACK ASSERTION: Optimistic log entry removed
      const logContainer = screen.getByTestId('activity-logs-88');
      expect(logContainer).not.toHaveTextContent(
        'Proof approved by Lead Supervisor'
      );

      // Non-intrusive error notification triggered
      expect(toast.error).toHaveBeenCalledWith(
        'Forbidden: You can only review proofs submitted by interns in your team hierarchy'
      );
    });

    it('rolls back optimistic changes upon network / Axios failure', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/tasks') {
          return Promise.resolve({ data: mockTasks });
        }
        if (url === '/proofs/task/42') {
          return Promise.resolve({ data: mockProofs });
        }
        if (url === '/departments') {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error(`Unhandled GET: ${url}`));
      });

      let rejectPatch;
      const patchPromise = new Promise((_, reject) => {
        rejectPatch = reject;
      });
      api.patch.mockReturnValue(patchPromise);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tasks']}>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(
        await screen.findByText('Complete Onboarding Checklist')
      ).toBeInTheDocument();

      const viewProofsBtn = screen.getByRole('button', {
        name: /view proofs/i,
      });
      fireEvent.click(viewProofsBtn);

      expect(await screen.findByText('PENDING')).toBeInTheDocument();

      const rejectBtn = screen.getByRole('button', { name: /reject/i });
      fireEvent.click(rejectBtn);

      // Optimistically REJECTED
      await waitFor(() => {
        expect(screen.getByText('REJECTED')).toBeInTheDocument();
      });

      // Network drops / connection timed out
      rejectPatch(new Error('Network Error: Connection timed out'));

      // Rollback to original PENDING status
      await waitFor(() => {
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        expect(screen.queryByText('REJECTED')).not.toBeInTheDocument();
      });

      // Toast error notified
      expect(toast.error).toHaveBeenCalledWith(
        'Network Error: Connection timed out'
      );
    });

    it('disables only the targeted proof action during pending mutation without freezing or blocking the rest of the workspace', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/tasks') return Promise.resolve({ data: mockTasks });
        if (url === '/proofs/task/42')
          return Promise.resolve({ data: mockProofs });
        if (url === '/departments') return Promise.resolve({ data: [] });
        return Promise.reject(new Error(`Unhandled GET: ${url}`));
      });

      let resolvePatch;
      const patchPromise = new Promise((resolve) => {
        resolvePatch = resolve;
      });
      api.patch.mockReturnValue(patchPromise);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tasks']}>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText('Complete Onboarding Checklist');
      fireEvent.click(screen.getByRole('button', { name: /view proofs/i }));

      await screen.findByText('PENDING');
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      fireEvent.click(approveBtn);

      // Optimistic update immediately shifts status to APPROVED and hides review action buttons without blocking the workspace
      await waitFor(() => {
        expect(screen.getByText('APPROVED')).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /^approve$/i })
        ).not.toBeInTheDocument();
      });

      // Other page controls remain active, unblocked, and interactive
      const hideProofsBtn = screen.getByRole('button', {
        name: /hide proofs/i,
      });
      expect(hideProofsBtn).not.toBeDisabled();

      resolvePatch({ data: { message: 'Approved' } });
    });

    it('rolls back and surfaces error notification on 404 proof not found error', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/tasks') return Promise.resolve({ data: mockTasks });
        if (url === '/proofs/task/42')
          return Promise.resolve({ data: mockProofs });
        if (url === '/departments') return Promise.resolve({ data: [] });
        return Promise.reject(new Error(`Unhandled GET: ${url}`));
      });

      let rejectPatch;
      const patchPromise = new Promise((_, reject) => {
        rejectPatch = reject;
      });
      api.patch.mockReturnValue(patchPromise);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/tasks']}>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await screen.findByText('Complete Onboarding Checklist');
      fireEvent.click(screen.getByRole('button', { name: /view proofs/i }));

      await screen.findByText('PENDING');
      fireEvent.click(screen.getByRole('button', { name: /approve/i }));

      // Optimistic shift
      await waitFor(() => {
        expect(screen.getByText('APPROVED')).toBeInTheDocument();
      });

      // 404 Not Found error
      rejectPatch({
        response: {
          status: 404,
          data: { error: 'Proof submission not found or has been revoked' },
        },
      });

      // Rollback
      await waitFor(() => {
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        expect(screen.queryByText('APPROVED')).not.toBeInTheDocument();
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Proof submission not found or has been revoked'
      );
    });
  });

  describe('TaskDetails Admin View Optimistic Updates & Rollbacks', () => {
    beforeEach(() => {
      useAuthStore.mockImplementation((selector) => {
        const state = {
          hydrated: true,
          accessToken: 'admin-token',
          user: mockAdminUser,
        };
        return typeof selector === 'function' ? selector(state) : state;
      });
    });

    const mockAnalytics = {
      task: {
        id: 77,
        title: 'Department Social Campaign',
        platform: 'Twitter',
        points: 50,
      },
      summary: {
        total_interns: 2,
        pending_count: 1,
        verified_count: 0,
        rejected_count: 0,
        not_submitted_count: 1,
        completion_rate: 0,
      },
      departmentStats: [],
      interns: [
        {
          id: 10,
          full_name: 'Alice Developer',
          email: 'alice@example.com',
          department_name: 'Engineering',
          position: 'Backend Intern',
          proof_id: 501,
          proof_status: 'PENDING',
          submitted_at: '2026-03-01T12:00:00Z',
          images: [{ id: 101, image_path: 'uploads/alice.png' }],
        },
      ],
    };

    it('optimistically approves proof and updates metrics immediately, rolling back on server error', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/tasks/77/analytics') {
          return Promise.resolve({ data: mockAnalytics });
        }
        if (url === '/departments') {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error(`Unhandled GET: ${url}`));
      });

      let rejectPatch;
      const patchPromise = new Promise((_, reject) => {
        rejectPatch = reject;
      });
      api.patch.mockReturnValue(patchPromise);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/admin/tasks/77']}>
            <Routes>
              <Route path="/admin/tasks/:taskId" element={<TaskDetails />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Wait for analytics data to render
      expect(
        await screen.findByText('Department Social Campaign')
      ).toBeInTheDocument();
      expect(screen.getByText('Alice Developer')).toBeInTheDocument();

      // Open proof inspection modal
      const viewProofBtn = screen.getByRole('button', { name: /view proof/i });
      fireEvent.click(viewProofBtn);

      // Verify modal opened and shows Pending Review
      expect(
        screen.getByText('Reported Engagement Actions')
      ).toBeInTheDocument();
      const approveProofBtn = screen.getByRole('button', {
        name: /approve proof/i,
      });

      // Click Approve Proof
      fireEvent.click(approveProofBtn);

      // OPTIMISTIC ASSERTION: Intern table badge updates to Verified / Completed immediately
      await waitFor(() => {
        expect(screen.getByText('Verified / Completed')).toBeInTheDocument();
      });

      // Fail the request downstream (e.g. database foreign key error or concurrency conflict)
      rejectPatch({
        response: {
          status: 500,
          data: { error: 'Database transaction deadlock, changes aborted' },
        },
      });

      // ROLLBACK ASSERTION: Reverts back to Pending Review
      await waitFor(() => {
        expect(screen.getByText('Pending Review')).toBeInTheDocument();
        expect(
          screen.queryByText('Verified / Completed')
        ).not.toBeInTheDocument();
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Database transaction deadlock, changes aborted'
      );
    });

    it('optimistically rejects proof in admin view and updates intern status badge to Rejected immediately', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/tasks/77/analytics') {
          return Promise.resolve({ data: mockAnalytics });
        }
        if (url === '/departments') {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error(`Unhandled GET: ${url}`));
      });

      let resolvePatch;
      const patchPromise = new Promise((resolve) => {
        resolvePatch = resolve;
      });
      api.patch.mockReturnValue(patchPromise);

      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/admin/tasks/77']}>
            <Routes>
              <Route path="/admin/tasks/:taskId" element={<TaskDetails />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(
        await screen.findByText('Department Social Campaign')
      ).toBeInTheDocument();

      const viewProofBtn = screen.getByRole('button', { name: /view proof/i });
      fireEvent.click(viewProofBtn);

      const rejectProofBtn = screen.getByRole('button', {
        name: /reject proof/i,
      });
      fireEvent.click(rejectProofBtn);

      // OPTIMISTIC ASSERTION: Intern table badge immediately shifts to Rejected
      await waitFor(() => {
        expect(screen.getByText('Rejected')).toBeInTheDocument();
      });

      expect(api.patch).toHaveBeenCalledWith('/proofs/501/reject');

      resolvePatch({ data: { message: 'Proof rejected' } });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/rejected/i)
        );
      });
    });
  });

  describe('ErrorBoundary Component Resilience', () => {
    function BrokenComponent({ shouldThrow }) {
      if (shouldThrow) {
        throw new Error('Downstream rendering failure');
      }
      return <div>Normal Content</div>;
    }

    it('renders custom fallback function with reset callback without crashing app', () => {
      // Suppress console.error during deliberate test error
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { rerender } = render(
        <ErrorBoundary
          fallback={(err, reset) => (
            <div data-testid="error-fallback">
              <span>Caught: {err.message}</span>
              <button onClick={reset}>Try Again</button>
            </div>
          )}
        >
          <BrokenComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('error-fallback')).toHaveTextContent(
        'Caught: Downstream rendering failure'
      );

      // Reset works when fixed component rerenders
      rerender(
        <ErrorBoundary
          fallback={(err, reset) => (
            <div data-testid="error-fallback">
              <span>Caught: {err.message}</span>
              <button onClick={reset}>Try Again</button>
            </div>
          )}
        >
          <BrokenComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(screen.getByText('Normal Content')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });
});
