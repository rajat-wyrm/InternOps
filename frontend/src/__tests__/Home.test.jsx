import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Home from '../pages/Home';
import useAuthStore from '../store/auth';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('../store/auth');

vi.mock('../lib/axios', () => ({
  default: {
    get: vi.fn(),
  },
  registerAuthStore: vi.fn(),
}));

describe('Home dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthStore.mockImplementation((selector) =>
      selector({
        user: {
          id: 'admin-1',
          role: 'ADMIN',
          email: 'admin@internops.test',
          full_name: 'Admin User',
        },
      })
    );

    useQuery
      .mockReturnValueOnce({
        data: { full_name: 'Admin User' },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: [
          { id: 'stl-1', role: 'SENIOR_TL', internship_status: 'ACTIVE' },
          { id: 'tl-1', role: 'TL', internship_status: 'ACTIVE' },
          { id: 'captain-1', role: 'CAPTAIN', internship_status: 'ACTIVE' },
          { id: 'intern-1', role: 'INTERN', internship_status: 'ACTIVE' },
          { id: 'intern-2', role: 'INTERN', internship_status: 'ACTIVE' },
        ],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      });
  });

  it('renders the Admin team summary without an undefined loading variable', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )
    ).not.toThrow();

    const totalMembersLabel = screen.getByText('Total team members');
    expect(totalMembersLabel).toBeInTheDocument();
    expect(totalMembersLabel.parentElement).toHaveTextContent(
      /^5Total team members/
    );
    expect(screen.getByText('1 Senior TL')).toBeInTheDocument();
    expect(screen.getByText('1 TL')).toBeInTheDocument();
    expect(screen.getByText('1 Captain')).toBeInTheDocument();
    expect(screen.getByText('2 Interns')).toBeInTheDocument();
  });
});
