const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getFourWeekRatingPeriods,
  getFourWeekIndex,
  validateFourWeekPeriod,
} = require('./ratingPeriods');
test('four official periods include remaining days in week four', () => {
  const p = getFourWeekRatingPeriods('2026-08');
  assert.equal(p.length, 4);
  assert.deepEqual(p[3], { week: 4, start: '2026-08-22', end: '2026-08-31' });
});
test('validates only official ranges', () => {
  assert.equal(validateFourWeekPeriod('2026-09-22', '2026-09-30'), true);
  assert.equal(validateFourWeekPeriod('2026-09-22', '2026-09-28'), false);
});

test('maps historical periods by their start date', () => {
  assert.equal(getFourWeekIndex('2026-08-03'), 0);
  assert.equal(getFourWeekIndex('2026-08-10'), 1);
  assert.equal(getFourWeekIndex('2026-08-17'), 2);
  assert.equal(getFourWeekIndex('2026-08-24'), 3);
});
