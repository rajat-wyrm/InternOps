const {
  getCurrentFourWeekRatingPeriod,
  getFourWeekRatingPeriods,
  isCurrentFourWeekPeriod,
} = require('../../src/modules/ratings/ratingPeriods');

describe('current four-week rating period', () => {
  const now = new Date('2026-09-02T12:00:00Z');

  test('selects the current month and current week', () => {
    expect(getCurrentFourWeekRatingPeriod(now)).toEqual({
      month: '2026-09',
      index: 0,
      period: { week: 1, start: '2026-09-01', end: '2026-09-07' },
    });
    expect(isCurrentFourWeekPeriod('2026-09-01', '2026-09-07', now)).toBe(true);
  });

  test('rejects a future week in the current month', () => {
    expect(isCurrentFourWeekPeriod('2026-09-08', '2026-09-14', now)).toBe(
      false
    );
  });

  test('rejects a past week in the current month', () => {
    const later = new Date('2026-09-16T12:00:00Z');
    expect(isCurrentFourWeekPeriod('2026-09-08', '2026-09-14', later)).toBe(
      false
    );
  });

  test('rejects a period from a previous month', () => {
    expect(isCurrentFourWeekPeriod('2026-08-22', '2026-08-31', now)).toBe(
      false
    );
  });

  test('uses the actual last day of the month for week four', () => {
    expect(getFourWeekRatingPeriods('2026-02')[3]).toEqual({
      week: 4,
      start: '2026-02-22',
      end: '2026-02-28',
    });
    expect(getFourWeekRatingPeriods('2028-02')[3].end).toBe('2028-02-29');
  });
});
