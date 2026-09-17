jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
const {
  activityAllowed,
  effectiveEnd,
} = require('../../src/modules/team/lifecycle');
describe('intern lifecycle activity policy', () => {
  test('active is allowed and on hold is paused', () => {
    expect(activityAllowed({ internship_status: 'ACTIVE' }, '2026-08-24')).toBe(
      true
    );
    expect(
      activityAllowed({ internship_status: 'ON_HOLD' }, '2026-08-24')
    ).toBe(false);
  });
  test('completion includes effective extended date', () => {
    const m = {
      internship_status: 'COMPLETED',
      completion_date: '2026-08-20',
      extended_completion_date: '2026-09-10',
    };
    expect(effectiveEnd(m)).toBe('2026-09-10');
    expect(activityAllowed(m, '2026-09-10')).toBe(true);
    expect(activityAllowed(m, '2026-09-11')).toBe(false);
  });
  test.each(['TERMINATED', 'DISCONTINUED'])(
    '%s locks starting on effective date',
    (status) => {
      const m = {
        internship_status: status,
        lifecycle_effective_date: '2026-08-24',
      };
      expect(activityAllowed(m, '2026-08-23')).toBe(true);
      expect(activityAllowed(m, '2026-08-24')).toBe(false);
    }
  );
});

describe('attendance month roster eligibility', () => {
  const {
    memberAppliesToRange,
  } = require('../../src/modules/attendance/repository');
  const from = '2026-03-01';
  const to = '2026-03-31';

  test('excludes a member before the joining month', () => {
    expect(
      memberAppliesToRange(
        { internship_status: 'ACTIVE', joining_date: '2026-04-05' },
        from,
        to
      )
    ).toBe(false);
  });

  test('includes the joining month and active months', () => {
    expect(
      memberAppliesToRange(
        { internship_status: 'ACTIVE', joining_date: '2026-03-20' },
        from,
        to
      )
    ).toBe(true);
    expect(
      memberAppliesToRange(
        { internship_status: 'ACTIVE', joining_date: '2026-02-20' },
        from,
        to
      )
    ).toBe(true);
  });

  test('includes the ending month and excludes later months', () => {
    for (const member of [
      {
        internship_status: 'COMPLETED',
        joining_date: '2026-01-01',
        completion_date: '2026-03-18',
      },
      {
        internship_status: 'TERMINATED',
        joining_date: '2026-01-01',
        lifecycle_effective_date: '2026-03-18',
      },
      {
        internship_status: 'DISCONTINUED',
        joining_date: '2026-01-01',
        lifecycle_effective_date: '2026-03-18',
      },
    ]) {
      expect(memberAppliesToRange(member, from, to)).toBe(true);
      expect(memberAppliesToRange(member, '2026-04-01', '2026-04-30')).toBe(
        false
      );
    }
  });

  test('uses an extended completion date before excluding a member', () => {
    const member = {
      internship_status: 'COMPLETED',
      joining_date: '2026-01-01',
      completion_date: '2026-03-18',
      extended_completion_date: '2026-04-12',
    };
    expect(memberAppliesToRange(member, '2026-04-01', '2026-04-30')).toBe(true);
    expect(memberAppliesToRange(member, '2026-05-01', '2026-05-31')).toBe(
      false
    );
  });
});
