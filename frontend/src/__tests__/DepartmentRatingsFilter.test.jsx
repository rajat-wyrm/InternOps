import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Ratings from '../pages/Ratings';
import DepartmentRatingsSheet from '../components/department/DepartmentRatingsSheet';
import api from '../lib/axios';
import useAuthStore from '../store/auth';

vi.mock('../lib/axios');
vi.mock('../store/auth');

const mockDepartments = [
  { id: 'dept-1', name: 'Engineering' },
  { id: 'dept-2', name: 'Marketing' },
];

const mockTeamMembers = [
  {
    id: 'user-1',
    full_name: 'Alice Cooper',
    email: 'alice@example.com',
    role: 'INTERN',
    department_id: 'dept-1',
    department_name: 'Engineering',
  },
  {
    id: 'user-2',
    full_name: 'Bob Marley',
    email: 'bob@example.com',
    role: 'INTERN',
    department_id: 'dept-2',
    department_name: 'Marketing',
  },
];

const mockSheetData = {
  members: [
    {
      id: 'user-1',
      full_name: 'Alice Cooper',
      email: 'alice@example.com',
      role: 'INTERN',
      department_name: 'Engineering',
      internship_status: 'ACTIVE',
      average_score: 8.4,
      latest_score: 9,
      rating_count: 5,
      latest_created_at: '2026-08-20',
      latest_remarks: 'Great work',
    },
    {
      id: 'user-2',
      full_name: 'Bob Marley',
      email: 'bob@example.com',
      role: 'INTERN',
      department_name: 'Marketing',
      internship_status: 'ACTIVE',
      average_score: 3.2,
      latest_score: 3,
      rating_count: 2,
      latest_created_at: '2026-08-19',
      latest_remarks: 'Needs improvement',
    },
    {
      id: 'user-3',
      full_name: 'Charlie Chaplin',
      email: 'charlie@example.com',
      role: 'INTERN',
      department_name: 'Engineering',
      internship_status: 'COMPLETED',
      average_score: 5.0,
      latest_score: 5,
      rating_count: 4,
      latest_created_at: '2026-08-18',
      latest_remarks: 'Good progress',
    },
  ],
};

describe('Department Ratings Sheet & Filtering', () => {
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
      if (url === '/departments') {
        return Promise.resolve({ data: mockDepartments });
      }
      if (url === '/team/members') {
        return Promise.resolve({ data: mockTeamMembers });
      }
      if (url.includes('/ratings/department/')) {
        return Promise.resolve({ data: mockSheetData });
      }
      if (url.startsWith('/ratings/')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  it('renders DepartmentRatingsSheet with eligibility badges correctly', () => {
    render(
      <DepartmentRatingsSheet
        departmentName="All Departments"
        data={mockSheetData}
        from="2026-01-01"
        to="2026-08-23"
        onFromChange={() => {}}
        onToChange={() => {}}
        isLoading={false}
        error={null}
        onRetry={() => {}}
      />
    );

    // Alice (8.4 => round 8 => Eligible), Charlie (5.0 => Eligible)
    expect(screen.getAllByText('🟢 Eligible')).toHaveLength(2);
    // Bob (3.2 => round 3 => Not Eligible)
    expect(screen.getAllByText('🔴 Not Eligible')).toHaveLength(1);

    expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    expect(screen.getByText('Bob Marley')).toBeInTheDocument();
    expect(screen.getByText('Charlie Chaplin')).toBeInTheDocument();
  });

  it('filters by rating value (e.g. 5) in DepartmentRatingsSheet', () => {
    render(
      <DepartmentRatingsSheet
        departmentName="All Departments"
        data={mockSheetData}
        from="2026-01-01"
        to="2026-08-23"
        onFromChange={() => {}}
        onToChange={() => {}}
        isLoading={false}
        error={null}
        onRetry={() => {}}
      />
    );

    // Select Rating filter = 5
    const ratingSelect = screen.getByLabelText(/Rating/i);
    fireEvent.change(ratingSelect, { target: { value: '5' } });

    // Only Charlie Chaplin has average_score 5.0 (rounded 5)
    expect(screen.getByText('Charlie Chaplin')).toBeInTheDocument();
    expect(screen.queryByText('Alice Cooper')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Marley')).not.toBeInTheDocument();
  });

  it('filters by eligibility status in DepartmentRatingsSheet', () => {
    render(
      <DepartmentRatingsSheet
        departmentName="All Departments"
        data={mockSheetData}
        from="2026-01-01"
        to="2026-08-23"
        onFromChange={() => {}}
        onToChange={() => {}}
        isLoading={false}
        error={null}
        onRetry={() => {}}
      />
    );

    // Select Eligibility = NOT_ELIGIBLE
    const eligibilitySelect = screen.getByLabelText(/Eligibility/i);
    fireEvent.change(eligibilitySelect, { target: { value: 'NOT_ELIGIBLE' } });

    // Only Bob Marley (score 3.2 => Not Eligible) should remain
    expect(screen.getByText('Bob Marley')).toBeInTheDocument();
    expect(screen.queryByText('Alice Cooper')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Chaplin')).not.toBeInTheDocument();
  });

  it('filters by search query in DepartmentRatingsSheet', () => {
    render(
      <DepartmentRatingsSheet
        departmentName="All Departments"
        data={mockSheetData}
        from="2026-01-01"
        to="2026-08-23"
        onFromChange={() => {}}
        onToChange={() => {}}
        isLoading={false}
        error={null}
        onRetry={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search members/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    expect(screen.queryByText('Bob Marley')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Chaplin')).not.toBeInTheDocument();
  });

  it('renders Ratings page with View All toggle for Admin when All Departments is selected', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ratings']}>
          <Routes>
            <Route path="/ratings" element={<Ratings />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('View Ratings History')).toBeInTheDocument();
    });

    // "View All" button should be visible even when All departments is selected
    const viewAllButton = screen.getByRole('button', { name: /View All/i });
    expect(viewAllButton).toBeInTheDocument();

    fireEvent.click(viewAllButton);

    await waitFor(() => {
      expect(screen.getByText('Department ratings sheet')).toBeInTheDocument();
    });
  });
});
