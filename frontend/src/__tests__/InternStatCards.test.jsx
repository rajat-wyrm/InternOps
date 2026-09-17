import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InternStatCards from '../components/admin/InternStatCards';
import api from '../lib/axios';

vi.mock('../lib/axios');

const mockMembers = [
  { id: '1', role: 'INTERN', internship_status: 'ACTIVE', suspended: false },
  { id: '2', role: 'INTERN', internship_status: 'ACTIVE', suspended: false },
  { id: '3', role: 'INTERN', internship_status: 'COMPLETED', suspended: false },
  {
    id: '4',
    role: 'INTERN',
    internship_status: 'TERMINATED',
    suspended: false,
  },
  {
    id: '5',
    role: 'INTERN',
    internship_status: 'DISCONTINUED',
    suspended: false,
  },
];

describe('InternStatCards Component', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <InternStatCards />
      </QueryClientProvider>
    );
  };

  it('renders all 5 intern statistic cards with correct labels', async () => {
    api.get.mockResolvedValueOnce({ data: mockMembers });

    renderComponent();

    expect(await screen.findByText('Total Interns')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Terminated')).toBeInTheDocument();
    expect(screen.getByText('Discontinued')).toBeInTheDocument();
  });

  it('calculates counts dynamically from team members API response', async () => {
    api.get.mockResolvedValueOnce({ data: mockMembers });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('stat-card-total-interns')).toHaveTextContent(
        '5'
      );
      expect(screen.getByTestId('stat-card-active-interns')).toHaveTextContent(
        '2'
      );
      expect(
        screen.getByTestId('stat-card-completed-interns')
      ).toHaveTextContent('1');
      expect(
        screen.getByTestId('stat-card-terminated-interns')
      ).toHaveTextContent('1');
      expect(
        screen.getByTestId('stat-card-discontinued-interns')
      ).toHaveTextContent('1');
    });
  });

  it('handles empty members array gracefully', async () => {
    api.get.mockResolvedValueOnce({ data: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('stat-card-total-interns')).toHaveTextContent(
        '0'
      );
      expect(screen.getByTestId('stat-card-active-interns')).toHaveTextContent(
        '0'
      );
      expect(
        screen.getByTestId('stat-card-completed-interns')
      ).toHaveTextContent('0');
      expect(
        screen.getByTestId('stat-card-terminated-interns')
      ).toHaveTextContent('0');
      expect(
        screen.getByTestId('stat-card-discontinued-interns')
      ).toHaveTextContent('0');
    });
  });
});
