import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NoticeBoard, { SAMPLE_NOTICES } from '../components/NoticeBoard';

describe('NoticeBoard Component', () => {
  it('renders initial sample notices sorted by priority (High -> Medium -> Low)', () => {
    render(<NoticeBoard />);

    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);

    expect(titles.length).toBe(6);

    expect(titles[0]).toBe('Portal Downtime');
    expect(titles[1]).toBe('Timesheet Reminder');

    expect(titles[2]).toBe('Onboarding Update');
    expect(titles[3]).toBe('Weekly Sync');

    expect(titles[4]).toBe('Referral Program');
    expect(titles[5]).toBe('Merch Store');
  });

  it('displays priority badges with correct labels and colors', () => {
    render(<NoticeBoard />);

    const urgentBadges = screen.getAllByText('URGENT');
    expect(urgentBadges.length).toBe(2);

    const mediumBadges = screen.getAllByText('MEDIUM');
    expect(mediumBadges.length).toBe(3);

    const lowBadges = screen.getAllByText('LOW');
    expect(lowBadges.length).toBe(3);
  });

  it('shows notice cards with left border matching priority color', () => {
    const { container } = render(<NoticeBoard />);
    const cards = container.querySelectorAll('.group.relative');

    expect(cards.length).toBe(6);

    expect(cards[0].style.borderLeftColor).toBe('rgb(239, 68, 68)');
    expect(cards[1].style.borderLeftColor).toBe('rgb(239, 68, 68)');

    expect(cards[2].style.borderLeftColor).toBe('rgb(245, 158, 11)');
    expect(cards[3].style.borderLeftColor).toBe('rgb(245, 158, 11)');

    expect(cards[4].style.borderLeftColor).toBe('rgb(34, 197, 94)');
    expect(cards[5].style.borderLeftColor).toBe('rgb(34, 197, 94)');
  });

  it('shows "No active notices." placeholder ONLY when notices array is empty', () => {
    render(<NoticeBoard initialNotices={[]} />);

    expect(screen.getByText('No active notices.')).toBeInTheDocument();
    expect(
      screen.getByText('There are currently no announcements to display.')
    ).toBeInTheDocument();
  });

  it('allows filtering notices by priority pills', () => {
    render(<NoticeBoard />);

    fireEvent.click(screen.getByRole('button', { name: 'HIGH' }));
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'MEDIUM' }));
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'LOW' }));
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'ALL' }));
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(6);
  });

  it('keeps a stable panel height while filters change', () => {
    const { container } = render(<NoticeBoard />);
    const board = container.firstElementChild;
    expect(board).toHaveClass('h-[560px]');
    fireEvent.click(screen.getByRole('button', { name: 'MEDIUM' }));
    expect(board).toHaveClass('h-[560px]');
    expect(container.querySelector('.notice-scrollbar')).toHaveClass(
      'min-h-0',
      'flex-1',
      'overflow-y-auto'
    );
  });
  it('allows clearing notices and reloading sample notices', () => {
    render(<NoticeBoard />);

    fireEvent.click(screen.getByText('Clear All'));
    expect(screen.getByText('No active notices.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Load Sample Notices'));
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(6);
  });
});
