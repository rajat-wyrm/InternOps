import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Tasks from '../pages/Tasks';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe('GitHub Issue #2068: Tasks.jsx Object URL memory leak prevention', () => {
  const mockInternUser = {
    id: 'intern-1',
    full_name: 'Intern Tester',
    email: 'intern@uptoskill.com',
    role: 'INTERN',
  };

  const mockTasks = [
    {
      id: 'task-101',
      title: 'LinkedIn Share Task',
      description: 'Share the announcement on LinkedIn',
      target_platform: 'LinkedIn',
      task_link: 'https://linkedin.com/post/123',
      deadline: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      id: 'task-102',
      title: 'Twitter Retweet Task',
      description: 'Retweet the product update',
      target_platform: 'Twitter',
      task_link: 'https://twitter.com/post/456',
      deadline: new Date(Date.now() + 86400000).toISOString(),
    },
  ];

  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let createObjectURLSpy;
  let revokeObjectURLSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    originalCreateObjectURL = window.URL.createObjectURL;
    originalRevokeObjectURL = window.URL.revokeObjectURL;

    let urlCounter = 0;
    createObjectURLSpy = vi.fn(
      () => `blob:http://localhost/test-blob-${++urlCounter}`
    );
    revokeObjectURLSpy = vi.fn();

    window.URL.createObjectURL = createObjectURLSpy;
    window.URL.revokeObjectURL = revokeObjectURLSpy;

    useAuthStore.mockImplementation((selector) => {
      const state = {
        user: mockInternUser,
        hydrated: true,
        accessToken: 'mock-token',
        activeDepartment: null,
      };
      return selector ? selector(state) : state;
    });

    api.get.mockImplementation((url) => {
      if (url === '/tasks' || url.startsWith('/tasks?')) {
        return Promise.resolve({ data: mockTasks });
      }
      if (url === '/proofs/my') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/departments') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('revokes created object URLs when the component unmounts with draft previews', async () => {
    const queryClient = createTestQueryClient();
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Tasks />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('LinkedIn Share Task')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    const file = new File(['dummy content'], 'proof.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const createdUrl = createObjectURLSpy.mock.results[0].value;

    expect(await screen.findByAltText('Preview')).toBeInTheDocument();

    unmount();

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(createdUrl);
  });

  it('revokes existing object URLs when new files are selected', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Tasks />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('LinkedIn Share Task')).toBeInTheDocument();
    });

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file1 = new File(['content 1'], 'proof1.png', { type: 'image/png' });
    fireEvent.change(fileInputs[0], { target: { files: [file1] } });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const url1 = createObjectURLSpy.mock.results[0].value;

    const remainingFileInput = document.querySelector('input[type="file"]');
    const file2 = new File(['content 2'], 'proof2.png', { type: 'image/png' });
    fireEvent.change(remainingFileInput, { target: { files: [file2] } });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url1);
  });

  it('revokes object URLs when draft submission is cancelled', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Tasks />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('LinkedIn Share Task')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'proof.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const createdUrl = createObjectURLSpy.mock.results[0].value;

    const cancelBtn = await screen.findByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(createdUrl);
  });

  it('revokes object URLs on successful proof submission', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true } });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Tasks />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('LinkedIn Share Task')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'proof.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const createdUrl = createObjectURLSpy.mock.results[0].value;

    // Check comment engagement checkbox
    const commentCheckbox = screen.getByLabelText(/comment/i);
    fireEvent.click(commentCheckbox);

    const uploadBtn = screen.getByRole('button', { name: /confirm upload/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(createdUrl);
    });
  });
});
