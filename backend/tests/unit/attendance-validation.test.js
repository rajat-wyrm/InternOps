'use strict';

const { isFutureDate } = require('../../src/modules/attendance/routes');

describe('Attendance Date Validation Unit Tests', () => {
  test('isFutureDate correctly identifies future dates', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    expect(isFutureDate(tomorrowStr)).toBe(true);
    expect(isFutureDate('2099-12-31')).toBe(true);
    expect(isFutureDate('2035-01-01')).toBe(true);
  });

  test('isFutureDate permits today and past dates', () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    expect(isFutureDate(todayStr)).toBe(false);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    expect(isFutureDate(yesterdayStr)).toBe(false);
    expect(isFutureDate('2020-01-01')).toBe(false);
    expect(isFutureDate('2024-06-15')).toBe(false);
  });
});
