import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '../pages/Login';
import api from '../lib/axios';

// Mock the axios API client
vi.mock('../lib/axios', () => {
  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
    registerAuthStore: vi.fn(),
    clearCsrfToken: vi.fn(),
  };
});

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Component Tests', () => {
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

    // Default mock response for notices
    api.get.mockResolvedValue({ data: [] });
  });

  const renderLogin = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders Login form correctly', () => {
    const { container } = renderLogin();

    expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
    expect(
      container.querySelector('input[type="password"]')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log In/i })).toBeInTheDocument();
    expect(screen.getByText(/Forgot Password\?/i)).toBeInTheDocument();
  });

  it('validates empty inputs and displays error', async () => {
    const { container } = renderLogin();

    const form = container.querySelector('form');
    fireEvent.submit(form);

    expect(
      await screen.findByText('Email and password required')
    ).toBeInTheDocument();
  });

  it('handles API error response gracefully', async () => {
    api.post.mockRejectedValue({
      response: {
        data: {
          error: 'Invalid credentials provided',
        },
      },
    });

    const { container } = renderLogin();

    fireEvent.change(container.querySelector('input[type="email"]'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(container.querySelector('input[type="password"]'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Log In/i }));

    expect(
      await screen.findByText('Invalid credentials provided')
    ).toBeInTheDocument();
  });

  it('submits form successfully and navigates to home', async () => {
    const mockUserData = { id: '1', email: 'test@example.com', role: 'ADMIN' };
    api.post.mockResolvedValue({
      data: {
        accessToken: 'validToken',
        user: mockUserData,
      },
    });

    const { container } = renderLogin();

    fireEvent.change(container.querySelector('input[type="email"]'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(container.querySelector('input[type="password"]'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Log In/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
