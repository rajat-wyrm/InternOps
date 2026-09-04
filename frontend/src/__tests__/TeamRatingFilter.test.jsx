import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Team from '../pages/Team';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

vi.mock('../lib/axios');
vi.mock('../store/auth');

const mockMembers = [
  {
    id: 'user-1',
    full_name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'INTERN',
    department_id: 'dept-1',
    department_name: 'Engineering',
    phone: '1234567890',
    rating: 8,
    avg_rating: 8,
    attendance_total: 10,
    present_count: 9,
    half_day_count: 0,
    internship_status: 'ACTIVE',
    verified_tasks: 5,
    total_tasks: 5,
    pending_proofs: 0,
  },
  {
    id: 'user-2',
    full_name: 'Bob Jones',
    email: 'bob@example.com',
    role: 'INTERN',
    department_id: 'dept-2',
    department_name: 'Marketing',
    phone: '0987654321',
    rating: 3,
    avg_rating: 3,
    attendance_total: 10,
    present_count: 5,
    half_day_count: 0,
    internship_status: 'ACTIVE',
    verified_tasks: 2,
    total_tasks: 4,
    pending_proofs: 0,
  },
  {
    id: 'user-3',
    full_name: 'Charlie Brown',
    email: 'charlie@example.com',
    role: 'INTERN',
    department_id: 'dept-1',
    department_name: 'Engineering',
    phone: '5555555555',
    rating: 5,
    avg_rating: 5,
    attendance_total: 10,
    present_count: 8,
    half_day_count: 0,
    internship_status: 'COMPLETED',
    verified_tasks: 10,
    total_tasks: 10,
    pending_proofs: 0,
  },
];

describe('Team Page - Rating & Eligibility Filtering', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.mockReturnValue({
      id: 'admin-1',
      role: 'ADMIN',
      email: 'admin@example.com',
    });

    api.get.mockImplementation((url) => {
      if (url === '/team/members') {
        return Promise.resolve({ data: mockMembers });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Team />
      </QueryClientProvider>
    );

  it('renders rating values and eligibility badges correctly in the table', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    // Alice: rating 8 => 🟢 Eligible
    // Bob: rating 3 => 🔴 Not Eligible
    // Charlie: rating 5 => 🟢 Eligible
    expect(screen.getAllByText('🟢 Eligible')).toHaveLength(2);
    expect(screen.getAllByText('🔴 Not Eligible')).toHaveLength(1);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('filters members when Rating filter is selected', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    // Select Rating filter = "3"
    const ratingDropdown = screen.getByRole('button', { name: /All Ratings/i });
    fireEvent.click(ratingDropdown);

    const option3 = screen.getByRole('button', { name: /^3$/ });
    fireEvent.click(option3);

    await waitFor(() => {
      expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
    });
  });

  it('filters members when Eligibility filter is selected', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    // Select Eligibility filter = "🔴 Not Eligible"
    const eligibilityDropdown = screen.getByRole('button', { name: /^All$/i });
    fireEvent.click(eligibilityDropdown);

    const notEligibleOption = screen.getByRole('button', {
      name: /🔴 Not Eligible/i,
    });
    fireEvent.click(notEligibleOption);

    await waitFor(() => {
      expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
    });
  });
});
