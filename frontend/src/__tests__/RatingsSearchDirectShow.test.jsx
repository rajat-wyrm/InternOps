import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Ratings from '../pages/Ratings';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

vi.mock('../lib/axios');
vi.mock('../store/auth');

const mockTeamMembers = [
  {
    id: 'user-1',
    full_name: 'Alice Cooper',
    email: 'alice@example.com',
    role: 'INTERN',
    department_id: 'dept-1',
  },
  {
    id: 'user-2',
    full_name: 'Bob Marley',
    email: 'bob@example.com',
    role: 'INTERN',
    department_id: 'dept-1',
  },
];

const mockDepartments = [{ id: 'dept-1', name: 'Engineering' }];

const aliceRatings = [
  {
    id: 'rating-3',
    score: 9,
    remarks: 'Excellent sprint, shipped ahead of schedule.',
    created_at: '2026-08-20T00:00:00.000Z',
  },
  {
    id: 'rating-2',
    score: 7,
    remarks: 'Solid but a couple of missed deadlines.',
    created_at: '2026-07-15T00:00:00.000Z',
  },
  {
    id: 'rating-1',
    score: 6,
    remarks: 'Good start, needs to speak up more in standups.',
    created_at: '2026-06-01T00:00:00.000Z',
  },
];

describe('Ratings history search bar - TL/Senior TL direct intern lookup', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useAuthStore.mockReturnValue({
      id: 'tl-1',
      role: 'TL',
      email: 'tl@example.com',
    });

    api.get.mockImplementation((url) => {
      if (url === '/team/members') {
        return Promise.resolve({ data: mockTeamMembers });
      }
      if (url === '/departments') {
        return Promise.resolve({ data: mockDepartments });
      }
      if (url === '/ratings/user-1') {
        return Promise.resolve({ data: aliceRatings });
      }
      if (url === '/ratings/user-2') {
        return Promise.resolve({ data: [] });
      }
      if (url.startsWith('/ratings/suggestions/')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  const renderRatings = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ratings']}>
          <Routes>
            <Route path="/ratings" element={<Ratings />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("shows the matched intern's ratings the moment a unique name is typed, with no click on the result needed", async () => {
    renderRatings();

    await waitFor(() => {
      expect(screen.getByText('View Ratings History')).toBeInTheDocument();
    });

    // Open the "Team Member" search bar under the ratings history section.
    // It defaults to showing the TL's own ratings ("Me (...)"), distinct
    // from the RatingForm's own separate "Select member..." trigger above it.
    fireEvent.click(
      screen.getByRole('button', { name: /Me \(tl@example\.com\)/i })
    );

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Alice Cooper' } });

    // No click on the found option - the intern's ratings should appear directly.
    await waitFor(() => {
      expect(
        screen.getByText('Excellent sprint, shipped ahead of schedule.')
      ).toBeInTheDocument();
    });

    // All of Alice's other ratings are listed serially underneath.
    expect(
      screen.getByText('Solid but a couple of missed deadlines.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Good start, needs to speak up more in standups.')
    ).toBeInTheDocument();

    // They appear in the (already chronological, most-recent-first) API order.
    const remarkNodes = screen.getAllByText(
      /Excellent sprint|Solid but a couple|Good start, needs/
    );
    expect(remarkNodes.map((node) => node.textContent)).toEqual([
      'Excellent sprint, shipped ahead of schedule.',
      'Solid but a couple of missed deadlines.',
      'Good start, needs to speak up more in standups.',
    ]);

    // The trigger now reflects the auto-selected member.
    expect(
      screen.getByRole('button', { name: /Alice Cooper \(INTERN\)/i })
    ).toBeInTheDocument();
  });

  it('does not fetch or show ratings for an ambiguous/no-match search term', async () => {
    renderRatings();

    await waitFor(() => {
      expect(screen.getByText('View Ratings History')).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Me \(tl@example\.com\)/i })
    );

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Zzz Nomatch' } });

    await waitFor(() => {
      expect(screen.getByText('No matches')).toBeInTheDocument();
    });

    expect(
      screen.queryByText('Excellent sprint, shipped ahead of schedule.')
    ).not.toBeInTheDocument();
  });
});
