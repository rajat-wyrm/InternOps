const { csvCell } = require('../../src/modules/reports/export');

describe('csvCell', () => {
  test('escapes spreadsheet formula triggers', () => {
    expect(csvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
  });

  test('escapes quotes and commas', () => {
    expect(csvCell('hello, "world"')).toBe('"hello, ""world"""');
  });

  test('returns plain values unchanged', () => {
    expect(csvCell('hello')).toBe('hello');
  });
});
