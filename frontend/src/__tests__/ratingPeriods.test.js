import { describe, expect, it } from 'vitest';
import {
  getFourWeekRatingPeriods,
  getFourWeekIndex,
} from '../utils/ratingPeriods';
describe('four-week rating periods', () => {
  it.each([
    ['2026-02', '2026-02-28'],
    ['2024-02', '2024-02-29'],
    ['2026-09', '2026-09-30'],
    ['2026-08', '2026-08-31'],
  ])('creates four periods for %s', (month, end) => {
    const periods = getFourWeekRatingPeriods(month);
    expect(periods).toHaveLength(4);
    expect(periods[0]).toMatchObject({
      start: `${month}-01`,
      end: `${month}-07`,
    });
    expect(periods[3].end).toBe(end);
  });
  it('maps end days into four weeks', () => {
    expect(
      [7, 8, 14, 15, 21, 22, 31].map((d) =>
        getFourWeekIndex(`2026-08-${String(d).padStart(2, '0')}`)
      )
    ).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
