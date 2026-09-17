import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Profile from '../pages/Profile';
import useAuthStore from '../store/auth';
import useFeatureFlagsStore from '../store/featureFlags';
import api from '../lib/axios';

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  registerAuthStore: vi.fn(),
}));

describe('Profile Page Avatar Rendering & Fallback Test Suite', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.setState({
      accessToken: 'test-token',
      hydrated: true,
      user: {
        id: 'admin-id',
        email: 'admin@internops.com',
        role: 'ADMIN',
        full_name: 'System Admin',
        avatar_url: null,
      },
    });

    useFeatureFlagsStore.setState({
      flags: {},
      loaded: true,
    });
  });

  it('renders default admin avatar for System Admin with no custom avatar', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'admin-id',
            email: 'admin@internops.com',
            role: 'ADMIN',
            full_name: 'System Admin',
            avatar_url: null,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const img = screen.getByAltText('avatar');
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toBe('/admin-default-avatar.svg');
    });

    expect(screen.queryByTitle('Remove profile image')).not.toBeInTheDocument();
  });

  it('renders custom avatar for System Admin with custom avatar URL', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'admin-id',
            email: 'admin@internops.com',
            role: 'ADMIN',
            full_name: 'System Admin',
            avatar_url: '/uploads/admin_avatar.png',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const img = screen.getByAltText('avatar');
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toContain('/uploads/admin_avatar.png');
    });

    expect(screen.getByTitle('Remove profile image')).toBeInTheDocument();
  });

  it('renders custom avatar for Non-admin (Intern) with custom avatar URL', async () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      hydrated: true,
      user: {
        id: 'intern-id',
        email: 'intern@internops.com',
        role: 'INTERN',
        full_name: 'Jane Doe',
        avatar_url: '/uploads/intern_avatar.png',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'intern-id',
            email: 'intern@internops.com',
            role: 'INTERN',
            full_name: 'Jane Doe',
            avatar_url: '/uploads/intern_avatar.png',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const img = await screen.findByAltText('avatar');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('/uploads/intern_avatar.png');
    expect(screen.getByTitle('Remove profile image')).toBeInTheDocument();
  });

  it('renders gradient initials circle for Non-admin with no avatar', async () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      hydrated: true,
      user: {
        id: 'intern-id',
        email: 'intern@internops.com',
        role: 'INTERN',
        full_name: 'Jane Doe',
        avatar_url: null,
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'intern-id',
            email: 'intern@internops.com',
            role: 'INTERN',
            full_name: 'Jane Doe',
            avatar_url: null,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('JD')).toBeInTheDocument();
    expect(screen.queryByAltText('avatar')).not.toBeInTheDocument();
  });

  it('gracefully falls back to default admin avatar when admin custom avatar errors', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'admin-id',
            email: 'admin@internops.com',
            role: 'ADMIN',
            full_name: 'System Admin',
            avatar_url: '/uploads/broken-avatar.png',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const img = screen.getByAltText('avatar');
      expect(img.getAttribute('src')).toContain('/uploads/broken-avatar.png');
    });

    const img = screen.getByAltText('avatar');
    // Trigger image error (e.g. 404 or network failure)
    fireEvent.error(img);

    // Should fall back to /admin-default-avatar.svg
    await waitFor(() => {
      const fallbackImg = screen.getByAltText('avatar');
      expect(fallbackImg.getAttribute('src')).toBe('/admin-default-avatar.svg');
    });
  });

  it('gracefully falls back to initials circle if admin default avatar also errors', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'admin-id',
            email: 'admin@internops.com',
            role: 'ADMIN',
            full_name: 'System Admin',
            avatar_url: '/uploads/broken-avatar.png',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const img = screen.getByAltText('avatar');
      expect(img.getAttribute('src')).toContain('/uploads/broken-avatar.png');
    });

    const img = screen.getByAltText('avatar');
    fireEvent.error(img); // custom avatar fails

    await waitFor(() => {
      const fallbackImg = screen.getByAltText('avatar');
      expect(fallbackImg.getAttribute('src')).toBe('/admin-default-avatar.svg');
    });

    const fallbackImg = screen.getByAltText('avatar');
    fireEvent.error(fallbackImg); // default avatar fails too

    // Should fall back to initials circle ('SA')
    await waitFor(() => {
      expect(screen.getByText('SA')).toBeInTheDocument();
      expect(screen.queryByAltText('avatar')).not.toBeInTheDocument();
    });
  });

  it('gracefully falls back to initials circle when non-admin custom avatar errors', async () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      hydrated: true,
      user: {
        id: 'intern-id',
        email: 'intern@internops.com',
        role: 'INTERN',
        full_name: 'Jane Doe',
        avatar_url: '/uploads/broken-intern.png',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'intern-id',
            email: 'intern@internops.com',
            role: 'INTERN',
            full_name: 'Jane Doe',
            avatar_url: '/uploads/broken-intern.png',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const img = screen.getByAltText('avatar');
      expect(img.getAttribute('src')).toContain('/uploads/broken-intern.png');
    });

    const img = screen.getByAltText('avatar');
    fireEvent.error(img);

    // Non-admin falls directly back to initials circle ('JD')
    await waitFor(() => {
      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(screen.queryByAltText('avatar')).not.toBeInTheDocument();
    });
  });

  it('renders avatar from authStore.user when available before profile loads', async () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      hydrated: true,
      user: {
        id: 'admin-id',
        email: 'admin@internops.com',
        role: 'ADMIN',
        full_name: 'System Admin',
        avatar_url: '/uploads/auth_cached_avatar.png',
      },
    });

    // Make API call pending or delay response
    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return new Promise(() => {}); // never resolves during initial render check
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const img = screen.getByAltText('avatar');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain(
      '/uploads/auth_cached_avatar.png'
    );
  });

  it('allows removing custom avatar via confirmation modal and sets avatar_url to null', async () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      hydrated: true,
      user: {
        id: 'admin-id',
        email: 'admin@internops.com',
        role: 'ADMIN',
        full_name: 'System Admin',
        avatar_url: '/uploads/removable_avatar.png',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'admin-id',
            email: 'admin@internops.com',
            role: 'ADMIN',
            full_name: 'System Admin',
            avatar_url: '/uploads/removable_avatar.png',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    api.delete.mockImplementation((url) => {
      if (url === '/uploads/avatar') {
        return Promise.resolve({
          data: { success: true, avatar_url: null },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTitle('Remove profile image')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Remove profile image'));

    // Modal should open
    expect(screen.getByText('Remove Profile Image?')).toBeInTheDocument();

    // Confirm removal
    fireEvent.click(screen.getByRole('button', { name: /Remove Image/i }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/uploads/avatar');
      expect(useAuthStore.getState().user.avatar_url).toBeNull();
    });
  });
});
