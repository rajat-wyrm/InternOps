import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PageHeader,
  UserAvatar,
  Card,
  Badge,
  Btn,
  Input,
  EmptyState,
  Spinner,
  Stars,
} from '../components/ui';

describe('Shared UI Components Test Suite', () => {
  // 1. PageHeader
  it('renders PageHeader with title and subtitle', () => {
    render(<PageHeader title="Test Title" subtitle="Test Subtitle" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  // 2. UserAvatar (with Image src)
  it('renders UserAvatar with image when src is provided', () => {
    const { container } = render(
      <UserAvatar name="John Doe" email="john@example.com" src="avatar.jpg" />
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'avatar.jpg');
  });

  // 3. UserAvatar (initials fallback)
  it('renders UserAvatar with initials when src is not provided', () => {
    render(<UserAvatar name="John Doe" email="john@example.com" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  // 4. Card
  it('renders Card content and applies custom className', () => {
    render(
      <Card className="custom-class">
        <span>Card Content</span>
      </Card>
    );
    expect(screen.getByText('Card Content')).toBeInTheDocument();
    expect(screen.getByText('Card Content').closest('.relative')).toHaveClass(
      'custom-class'
    );
  });

  // 5. Badge
  it('renders Badge with correct color class and content', () => {
    render(<Badge color="green">Active</Badge>);
    const badge = screen.getByText('Active');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-emerald-50');
  });

  // 6. Btn (Render & Click Interaction)
  it('renders Btn and handles click events', () => {
    const handleClick = vi.fn();
    render(<Btn onClick={handleClick}>Click Me</Btn>);
    const button = screen.getByRole('button', { name: 'Click Me' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // 7. Btn (Disabled State)
  it('does not trigger onClick when Btn is disabled', () => {
    const handleClick = vi.fn();
    render(
      <Btn onClick={handleClick} disabled>
        Disabled Button
      </Btn>
    );
    const button = screen.getByRole('button', { name: 'Disabled Button' });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  // 8. Input (State and Value Changes)
  it('renders Input and handles text changes', () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Enter text" onChange={handleChange} />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(handleChange).toHaveBeenCalled();
    expect(input.value).toBe('Hello');
  });

  // 9. EmptyState
  it('renders EmptyState with custom icon, title, and descriptive text', () => {
    render(
      <EmptyState icon="👋" title="Empty Title" text="No data available" />
    );
    expect(screen.getByText('👋')).toBeInTheDocument();
    expect(screen.getByText('Empty Title')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  // 10. Spinner
  it('renders Spinner with default or custom label', () => {
    render(<Spinner label="Processing..." />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  // 11. Stars
  it('renders Stars with correct rating characters', () => {
    render(<Stars value={3} />);
    const starContainer = screen.getByTitle('3');
    expect(starContainer).toBeInTheDocument();
    expect(starContainer.textContent).toBe('★★★★★');
  });
});
