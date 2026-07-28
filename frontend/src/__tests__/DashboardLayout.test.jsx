import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardLayout from '../layouts/DashboardLayout';
import useAuthStore from '../store/auth';
import useFeatureFlagsStore from '../store/featureFlags';
import api from '../lib/axios';

// Mock api
vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  registerAuthStore: vi.fn(),
  clearCsrfToken: vi.fn(),
}));

// Mock socket
vi.mock('../lib/socket', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('DashboardLayout Component Tests', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();

    // Reset Zustand stores
    useAuthStore.setState({
      accessToken: null,
      user: null,
      hydrated: false,
    });

    // Default feature flags
    useFeatureFlagsStore.setState({
      flags: {
        ADVANCED_ANALYTICS: true,
        CANVA_INTEGRATION: true,
        AI_CERT_GENERATOR: true,
      },
    });

    // Default API mock implementation for /users/me
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            full_name: 'Jane Doe',
            avatar_url: 'avatar.jpg',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  const renderLayout = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardLayout />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders common navigation links for any logged-in user', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: { id: '1', email: 'user@example.com', role: 'INTERN' },
    });

    renderLayout();

    expect(
      await screen.findByText('Dashboard', { selector: 'span' })
    ).toBeInTheDocument();
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Ratings')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Meetings')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();

    // Interns should not see administrative options
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Departments')).not.toBeInTheDocument();
  });

  it('renders administrative navigation links for ADMIN users', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: { id: '1', email: 'admin@example.com', role: 'ADMIN' },
    });

    renderLayout();

    expect(await screen.findByText('Users')).toBeInTheDocument();
    expect(
      screen.getByText('Dashboard', { selector: 'span' })
    ).toBeInTheDocument();
    expect(screen.getByText('Departments')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('triggers logout flow when log out button is clicked', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: { id: '1', email: 'user@example.com', role: 'INTERN' },
    });

    renderLayout();

    const logoutBtn = await screen.findByTitle('Logout');
    fireEvent.click(logoutBtn);

    // Confirm that the confirmation modal pops up
    expect(
      screen.getByText(/Are you sure you want to log out/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByText('Logout', { selector: 'button' });
    fireEvent.click(confirmBtn);

    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
