import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardLayout from '../layouts/DashboardLayout';
import useAuthStore from '../store/auth';
import useFeatureFlagsStore from '../store/featureFlags';
import api from '../lib/axios';
import { disconnectSocket } from '../lib/socket';

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

const fakeSocket = {
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('../lib/socket', () => ({
  connectSocket: vi.fn(() => fakeSocket),
  disconnectSocket: vi.fn(),
  getSocket: vi.fn(() => fakeSocket),
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
  it('loads the floating chatbot only for eligible roles', () => {
    const layoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/layouts/DashboardLayout.jsx'),
      'utf8'
    );

    expect(layoutSource).toContain(
      "const FloatingChatbot = lazy(() => import('../components/FloatingChatbot'));"
    );

    expect(layoutSource).toMatch(
      /import \{[\s\S]*\blazy,[\s\S]*\bSuspense,[\s\S]*\} from 'react';/
    );

    expect(layoutSource).toContain(
      "const FLOATING_CHATBOT_ROLES = ['ADMIN', 'SENIOR_TL', 'TL'];"
    );

    expect(layoutSource).toContain(
      'const canUseFloatingChatbot = FLOATING_CHATBOT_ROLES.includes(role);'
    );

    expect(layoutSource).toContain(
      "loc.pathname !== '/profile' && canUseFloatingChatbot"
    );

    expect(layoutSource).toContain('<Suspense fallback={null}>');

    expect(layoutSource).not.toContain(
      "import FloatingChatbot from '../components/FloatingChatbot';"
    );
  });

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

    useAuthStore.setState({
      accessToken: null,
      user: null,
      hydrated: false,
    });

    useFeatureFlagsStore.setState({
      flags: {
        ADVANCED_ANALYTICS: true,
        CANVA_INTEGRATION: true,
        AI_CERT_GENERATOR: true,
      },
    });

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
        <MemoryRouter initialEntries={['/notifications']}>
          <DashboardLayout />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('keeps one skeleton owner mounted for coordinated initial loading', () => {
    const layoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/layouts/DashboardLayout.jsx'),
      'utf8'
    );

    const coordinatorSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/components/loading/RouteInitialLoading.jsx'
      ),
      'utf8'
    );

    expect(layoutSource).toContain(
      'COORDINATED_LOADING_ROUTES.has(loc.pathname)'
    );

    expect(layoutSource).toContain(
      '<RouteInitialLoading animate={shouldAnimateRoute}>'
    );

    expect(coordinatorSource).toContain(
      '{loading ? <RouteRefreshSkeleton /> : null}'
    );

    expect(coordinatorSource).toContain(
      '<Suspense fallback={null}>{children}</Suspense>'
    );
  });

  it('keeps feature navigation and account footer stable during hydration', () => {
    const layoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/layouts/DashboardLayout.jsx'),
      'utf8'
    );

    expect(layoutSource).toContain(
      '!flagsLoaded || flags[item.featureFlag] === true'
    );

    expect(layoutSource).not.toContain('user?.email;');

    expect(layoutSource).toContain('aria-label="Loading account name"');
  });

  it('renders common navigation links for any logged-in user', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: '1',
        email: 'user@example.com',
        role: 'INTERN',
      },
    });

    renderLayout();

    expect(
      await screen.findByText('Dashboard', { selector: 'span' })
    ).toBeInTheDocument();

    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Ratings')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Meetings')).toBeInTheDocument();

    expect(
      screen.getAllByRole('link', { name: 'Notifications' })[0]
    ).toHaveAttribute('href', '/notifications');

    expect(screen.getByText('Profile')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute(
      'href',
      '/requests'
    );

    expect(screen.getByText('Sessions')).toBeInTheDocument();

    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Departments')).not.toBeInTheDocument();
  });

  it('renders administrative navigation links for ADMIN users', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
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
      user: {
        id: '1',
        email: 'user@example.com',
        role: 'INTERN',
      },
    });

    renderLayout();

    const logoutBtn = await screen.findByTitle('Logout');

    fireEvent.click(logoutBtn);

    expect(
      screen.getByText(/Are you sure you want to log out/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByText('Logout', {
      selector: 'button',
    });

    fireEvent.click(confirmBtn);

    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('renders unread count badge when there are unread notifications', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: '1',
        email: 'user@example.com',
        role: 'INTERN',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            full_name: 'Jane Doe',
            avatar_url: 'avatar.jpg',
          },
        });
      }

      if (url === '/notifications/unread-count') {
        return Promise.resolve({
          data: { unread: 5 },
        });
      }

      return Promise.resolve({ data: {} });
    });

    renderLayout();

    expect(await screen.findByText('5')).toBeInTheDocument();
  });

  it('caps unread count badge display at 9+ when count is greater than 9', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: '1',
        email: 'user@example.com',
        role: 'INTERN',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            full_name: 'Jane Doe',
            avatar_url: 'avatar.jpg',
          },
        });
      }

      if (url === '/notifications/unread-count') {
        return Promise.resolve({
          data: { unread: 15 },
        });
      }

      return Promise.resolve({ data: {} });
    });

    renderLayout();

    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('does not render unread count badge when count is 0', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: '1',
        email: 'user@example.com',
        role: 'INTERN',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            full_name: 'Jane Doe',
            avatar_url: 'avatar.jpg',
          },
        });
      }

      if (url === '/notifications/unread-count') {
        return Promise.resolve({
          data: { unread: 0 },
        });
      }

      return Promise.resolve({ data: {} });
    });

    renderLayout();

    await screen.findByText('Dashboard', { selector: 'span' });

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('9+')).not.toBeInTheDocument();
  });

  it('updates the badge instantly from a "notification-received" socket event', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: '1',
        email: 'user@example.com',
        role: 'INTERN',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            full_name: 'Jane Doe',
            avatar_url: 'avatar.jpg',
          },
        });
      }

      if (url === '/notifications/unread-count') {
        return Promise.resolve({
          data: { unread: 0 },
        });
      }

      return Promise.resolve({ data: {} });
    });

    renderLayout();

    await screen.findByText('Dashboard', { selector: 'span' });

    expect(screen.queryByText('3')).not.toBeInTheDocument();

    expect(fakeSocket.on).toHaveBeenCalledWith(
      'notification-received',
      expect.any(Function)
    );

    const handler = fakeSocket.on.mock.calls.find(
      ([event]) => event === 'notification-received'
    )[1];

    handler({
      notification: { id: 'n1' },
      unreadCount: 3,
    });

    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('cleans up the notification socket listener when unmounted', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      user: {
        id: '1',
        email: 'user@example.com',
        role: 'INTERN',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            full_name: 'Jane Doe',
            avatar_url: 'avatar.jpg',
          },
        });
      }

      if (url === '/notifications/unread-count') {
        return Promise.resolve({
          data: { unread: 0 },
        });
      }

      return Promise.resolve({ data: {} });
    });

    const { unmount } = renderLayout();

    await screen.findByText('Dashboard', { selector: 'span' });

    const handler = fakeSocket.on.mock.calls.find(
      ([event]) => event === 'notification-received'
    )[1];

    expect(handler).toEqual(expect.any(Function));

    unmount();

    expect(fakeSocket.off).toHaveBeenCalledWith(
      'notification-received',
      handler
    );

    expect(disconnectSocket).toHaveBeenCalledTimes(1);
  });

  it('keeps the cached uploaded avatar while the server profile is pending', async () => {
    let resolveProfile;

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return new Promise((resolve) => {
          resolveProfile = resolve;
        });
      }

      return Promise.resolve({ data: {} });
    });

    useAuthStore.setState({
      accessToken: 'token',
      hydrated: true,
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
        full_name: 'System Admin',
        avatar_url: '/uploads/cached-avatar.png',
      },
    });

    const { container } = renderLayout();

    await waitFor(() => {
      expect(
        container.querySelectorAll('img[src$="/uploads/cached-avatar.png"]')
      ).toHaveLength(2);
    });

    expect(
      container.querySelector('img[src="/admin-default-avatar.svg"]')
    ).not.toBeInTheDocument();

    resolveProfile({
      data: {
        full_name: 'System Admin',
        avatar_url: '/uploads/server-avatar.png',
      },
    });

    await waitFor(() => {
      expect(
        container.querySelectorAll('img[src$="/uploads/server-avatar.png"]')
      ).toHaveLength(2);
    });

    expect(
      container.querySelector('img[src$="/uploads/cached-avatar.png"]')
    ).not.toBeInTheDocument();
  });

  it('uses the admin default avatar only after the server confirms no upload', async () => {
    useAuthStore.setState({
      accessToken: 'token',
      hydrated: true,
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
        full_name: 'System Admin',
        avatar_url: '/uploads/cached-avatar.png',
      },
    });

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            full_name: 'System Admin',
            avatar_url: null,
          },
        });
      }

      return Promise.resolve({ data: {} });
    });

    const { container } = renderLayout();

    await waitFor(() => {
      expect(
        container.querySelectorAll('img[src="/admin-default-avatar.svg"]')
      ).toHaveLength(2);
    });

    expect(
      container.querySelector('img[src$="/uploads/cached-avatar.png"]')
    ).not.toBeInTheDocument();
  });

  it('does not show the default admin avatar before auth hydration', async () => {
    api.get.mockImplementation(() => Promise.resolve({ data: {} }));

    useAuthStore.setState({
      accessToken: null,
      hydrated: false,
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
        full_name: 'System Admin',
      },
    });

    const { container } = renderLayout();

    expect(
      container.querySelector('img[src="/admin-default-avatar.svg"]')
    ).not.toBeInTheDocument();

    useAuthStore.setState({
      accessToken: 'token',
      hydrated: true,
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
        full_name: 'System Admin',
        avatar_url: '/uploads/refreshed-avatar.png',
      },
    });

    await waitFor(() => {
      expect(
        container.querySelectorAll('img[src$="/uploads/refreshed-avatar.png"]')
      ).toHaveLength(2);
    });

    expect(
      container.querySelector('img[src="/admin-default-avatar.svg"]')
    ).not.toBeInTheDocument();
  });

  it('keeps both account avatars neutral until the profile request resolves', async () => {
    let resolveProfile;

    api.get.mockImplementation((url) => {
      if (url === '/users/me') {
        return new Promise((resolve) => {
          resolveProfile = resolve;
        });
      }

      return Promise.resolve({ data: {} });
    });

    useAuthStore.setState({
      accessToken: null,
      hydrated: false,
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
        full_name: 'System Admin',
      },
    });

    const { container } = renderLayout();

    expect(screen.getAllByLabelText('Loading account avatar')).toHaveLength(2);

    expect(
      container.querySelector('img[src="/admin-default-avatar.svg"]')
    ).not.toBeInTheDocument();

    expect(
      container.querySelector('header img[alt=""]')
    ).not.toBeInTheDocument();

    await act(async () => {
      useAuthStore.setState({
        accessToken: 'token',
        hydrated: true,
      });
    });

    expect(screen.getAllByLabelText('Loading account avatar')).toHaveLength(2);

    expect(
      container.querySelector('img[src="/admin-default-avatar.svg"]')
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveProfile({
        data: {
          full_name: 'System Admin',
          avatar_url: '/uploads/final-avatar.png',
        },
      });
    });

    await waitFor(() => {
      expect(
        container.querySelectorAll('img[src$="/uploads/final-avatar.png"]')
      ).toHaveLength(2);
    });

    expect(
      screen.queryByLabelText('Loading account avatar')
    ).not.toBeInTheDocument();

    expect(
      container.querySelector('img[src="/admin-default-avatar.svg"]')
    ).not.toBeInTheDocument();
  });
});
