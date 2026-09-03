const service = require('../../src/modules/internops/service');

describe('InternOps Service', () => {
  test('correctly aggregates attendance and ratings', () => {
    // We pass dates for Aug 17 to Aug 23, 2026.
    const summary = service.getSummary('2026-08-17', '2026-08-23');

    // We expect 5 interns since we seeded 5 interns in the CSV.
    expect(summary.length).toBe(5);

    // Let's verify Sneha Kulkarni's calculations:
    // sneha.intern@internops.com has 5 attendance records in range: 4 PRESENT, 1 ABSENT.
    // Ratings: 17 (score 5), 19 (score 4), 21 (score 5).
    // Attendance % = 80%. Avg rating = 4.67. Latest rating = 5. Trend = UP. Status = Good.
    const sneha = summary.find((i) => i.email === 'sneha.intern@internops.com');
    expect(sneha).toBeDefined();
    expect(sneha.name).toBe('Sneha Kulkarni');
    expect(sneha.totalAttendance).toBe(5);
    expect(sneha.presentDays).toBe(4);
    expect(sneha.attendancePercentage).toBe(80);
    expect(sneha.numRatings).toBe(3);
    expect(sneha.avgRating).toBe(4.67);
    expect(sneha.latestRating).toBe(5);
    expect(sneha.ratingTrend).toBe('UP');
    expect(sneha.status).toBe('Good');

    // Let's verify Aditya Deshmukh's calculations:
    // aditya.intern@internops.com has 3 ratings: 17 (4), 19 (3), 21 (4).
    // Total = 3. Avg = 3.67. Status = Attention Required (since avgRating < 4.0).
    const aditya = summary.find(
      (i) => i.email === 'aditya.intern@internops.com'
    );
    expect(aditya).toBeDefined();
    expect(aditya.attendancePercentage).toBe(100);
    expect(aditya.avgRating).toBe(3.67);
    expect(aditya.status).toBe('Attention Required');
  });

  test('filters by custom date range', () => {
    // If range is Aug 17 to Aug 18, 2026.
    const summary = service.getSummary('2026-08-17', '2026-08-18');
    const sneha = summary.find((i) => i.email === 'sneha.intern@internops.com');
    expect(sneha).toBeDefined();
    // In that range, Sneha has 2 attendance records (both PRESENT)
    expect(sneha.totalAttendance).toBe(2);
    expect(sneha.presentDays).toBe(2);
    expect(sneha.attendancePercentage).toBe(100);
    // She has 1 rating of 5 on Aug 17.
    expect(sneha.numRatings).toBe(1);
    expect(sneha.avgRating).toBe(5);
    expect(sneha.latestRating).toBe(5);
    expect(sneha.ratingTrend).toBe('INSUFFICIENT');
  });
});
