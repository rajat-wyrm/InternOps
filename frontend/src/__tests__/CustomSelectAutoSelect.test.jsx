import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomSelect from '../components/CustomSelect';

const options = [
  { value: 'user-1', label: 'Alice Cooper (INTERN)' },
  { value: 'user-2', label: 'Bob Marley (INTERN)' },
  { value: 'user-3', label: 'Alice Smith (INTERN)' },
];

describe('CustomSelect - autoSelectOnMatch', () => {
  it('selects the option immediately once the search term uniquely matches it, with no click required', async () => {
    const handleChange = vi.fn();

    render(
      <CustomSelect
        value=""
        onChange={handleChange}
        options={options}
        placeholder="Select member"
        searchable
        autoSelectOnMatch
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select member/i }));

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Bob' } });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('user-2');
    });
    // No option button was ever clicked - selection happened purely from typing.
  });

  it('does not auto-select while the search term matches more than one option', async () => {
    const handleChange = vi.fn();

    render(
      <CustomSelect
        value=""
        onChange={handleChange}
        options={options}
        placeholder="Select member"
        searchable
        autoSelectOnMatch
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select member/i }));

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    await waitFor(() => {
      expect(screen.getByText('Alice Cooper (INTERN)')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith (INTERN)')).toBeInTheDocument();
    });

    expect(handleChange).not.toHaveBeenCalled();

    // Narrowing the term further down to a single match now auto-selects.
    fireEvent.change(searchInput, { target: { value: 'Alice Smith' } });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith('user-3');
    });
  });

  it('never auto-selects when autoSelectOnMatch is not enabled (default behavior preserved)', async () => {
    const handleChange = vi.fn();

    render(
      <CustomSelect
        value=""
        onChange={handleChange}
        options={options}
        placeholder="Select member"
        searchable
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Select member/i }));

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Bob' } });

    await waitFor(() => {
      expect(screen.getByText('Bob Marley (INTERN)')).toBeInTheDocument();
    });

    expect(handleChange).not.toHaveBeenCalled();
  });
});
