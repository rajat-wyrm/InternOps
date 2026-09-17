import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/pages/Team.jsx'),
  'utf8'
);

describe('Team member complete information UI', () => {
  it.each([
    'Account created',
    'Reports to',
    'Department',
    'Intern Code',
    'Internship Domain',
    'Present records',
    'Informed records',
    'Leave records',
    'Total attendance records',
    'Average rating',
    'Rating count',
    'Verified tasks',
    'Pending proofs',
    'Total tasks',
  ])('shows %s in member Details', (label) => {
    expect(source).toContain(`label="${label}"`);
  });

  it.each([
    "key: 'email'",
    "key: 'department_id'",
    "key: 'intern_code'",
    "key: 'internship_domain'",
    "key: 'offer_letter_url'",
  ])('offers the supported edit control %s', (field) => {
    expect(source).toContain(field);
  });

  it('uses status-specific lifecycle labels and keeps protected management controls', () => {
    expect(source).toContain('Planned Completion Date');
    expect(source).toContain('Extended Completion Date');
    expect(source).toContain('Completion Date');
    expect(source).toContain('Effective Date');
    expect(source).toContain('Reset Password');
    expect(source).toContain('Reports to');
  });
});
