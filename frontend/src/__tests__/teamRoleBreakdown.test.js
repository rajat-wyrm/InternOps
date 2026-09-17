import { describe, expect, it } from 'vitest';
import { getTeamRoleBreakdown } from '../utils/teamRoleBreakdown';

const members = [
  { role: 'SENIOR_TL' },
  { role: 'TL' },
  { role: 'CAPTAIN' },
  { role: 'CAPTAIN' },
  { role: 'INTERN' },
  { role: 'INTERN' },
  { role: 'INTERN' },
];

describe('getTeamRoleBreakdown', () => {
  it('uses two complete rows for Admin', () => {
    expect(getTeamRoleBreakdown('ADMIN', members)).toEqual([
      [
        { role: 'SENIOR_TL', count: 1, label: 'Senior TL' },
        { role: 'TL', count: 1, label: 'TL' },
      ],
      [
        { role: 'CAPTAIN', count: 2, label: 'Captains' },
        { role: 'INTERN', count: 3, label: 'Interns' },
      ],
    ]);
  });

  it('puts a Senior TL Intern count on its own second row', () => {
    expect(getTeamRoleBreakdown('SENIOR_TL', members)).toEqual([
      [
        { role: 'TL', count: 1, label: 'TL' },
        { role: 'CAPTAIN', count: 2, label: 'Captains' },
      ],
      [{ role: 'INTERN', count: 3, label: 'Interns' }],
    ]);
  });

  it('keeps the TL layout as one Captain and Intern row', () => {
    expect(getTeamRoleBreakdown('TL', members)).toEqual([
      [
        { role: 'CAPTAIN', count: 2, label: 'Captains' },
        { role: 'INTERN', count: 3, label: 'Interns' },
      ],
    ]);
  });

  it('shows only Interns to a Captain', () => {
    expect(getTeamRoleBreakdown('CAPTAIN', members)).toEqual([
      [{ role: 'INTERN', count: 3, label: 'Interns' }],
    ]);
  });

  it('returns no rows for an empty scoped team', () => {
    expect(getTeamRoleBreakdown('SENIOR_TL', [])).toEqual([]);
  });
});
