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

  it('keeps clear spacing around the Forgot Password link', () => {
    const { container } = renderLogin();
    const link = screen.getByRole('link', { name: /Forgot Password[?]/i });
    expect(link).toHaveClass('inline-flex', 'py-1', 'text-white/55');
    expect(link.parentElement).toHaveClass('mt-2', 'justify-end');
    expect(
      container.querySelector('input[type="password"]')
    ).toBeInTheDocument();
  });

  it('validates empty inputs and displays error', async () => {
    const { container } = renderLogin();

    const form = container.querySelector('form');
    fireEvent.submit(form);

    expect(
      await screen.findByText('Email and password required')
    ).toBeInTheDocument();
  });

  it('removes spaces from email and password input', () => {
    const { container } = renderLogin();
    const emailInput = container.querySelector('input[type="email"]');
    const passwordInput = container.querySelector('input[type="password"]');
    fireEvent.change(emailInput, { target: { value: ' test @example.com ' } });
    fireEvent.change(passwordInput, { target: { value: 'pass word 123' } });
    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
    expect(
      screen.queryByText('Email and password cannot contain spaces')
    ).not.toBeInTheDocument();
  });

  it('silently blocks the Space key in both credential fields', () => {
    const { container } = renderLogin();
    for (const input of container.querySelectorAll('input')) {
      const event = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(
      screen.queryByText('Email and password cannot contain spaces')
    ).not.toBeInTheDocument();
  });

  it('normalizes email before login', async () => {
    api.post.mockResolvedValue({
      data: {
        accessToken: 'validToken',
        user: { id: '1', email: 'test@example.com', role: 'ADMIN' },
      },
    });
    const { container } = renderLogin();
    fireEvent.change(container.querySelector('input[type="email"]'), {
      target: { value: 'TEST@EXAMPLE.COM' },
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
    });
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
