const {
  calculateFallbackRating,
  parseFallbackPayload,
} = require('../../src/modules/ratings/fallback.service');

describe('ratings fallback service', () => {
  it('treats malicious JavaScript strings as data instead of executing them', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const payload = 'console.log("pwned")';
    const parsed = parseFallbackPayload(payload);

    expect(parsed).toEqual({ raw: payload });
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('produces a fallback recommendation from metrics', () => {
    const recommendation = calculateFallbackRating({
      attendancePercentage: 92,
      verificationRate: 88,
      averageRating: 7,
    });

    expect(recommendation.source).toBe('fallback');
    expect(recommendation.suggestedScore).toBeGreaterThan(0);
    expect(recommendation.reasoning).toContain('Fallback estimate');
  });

  it('assigns the correct attendance reasoning tier for each score bucket', () => {
    expect(
      calculateFallbackRating({
        attendancePercentage: 95,
        verificationRate: 90,
      }).reasoning
    ).toContain('strong attendance');

    expect(
      calculateFallbackRating({
        attendancePercentage: 80,
        verificationRate: 90,
      }).reasoning
    ).toContain('strong attendance');

    expect(
      calculateFallbackRating({
        attendancePercentage: 70,
        verificationRate: 90,
      }).reasoning
    ).toContain('average attendance');

    expect(
      calculateFallbackRating({
        attendancePercentage: 60,
        verificationRate: 90,
      }).reasoning
    ).toContain('average attendance');

    expect(
      calculateFallbackRating({
        attendancePercentage: 59,
        verificationRate: 90,
      }).reasoning
    ).toContain('weak attendance');
  });

  it('assigns the correct task reasoning tier for each score bucket', () => {
    expect(
      calculateFallbackRating({
        attendancePercentage: 95,
        verificationRate: 90,
      }).reasoning
    ).toContain('reliable task verification');

    expect(
      calculateFallbackRating({
        attendancePercentage: 95,
        verificationRate: 80,
      }).reasoning
    ).toContain('reliable task verification');

    expect(
      calculateFallbackRating({
        attendancePercentage: 95,
        verificationRate: 70,
      }).reasoning
    ).toContain('moderate task verification');

    expect(
      calculateFallbackRating({
        attendancePercentage: 95,
        verificationRate: 60,
      }).reasoning
    ).toContain('moderate task verification');

    expect(
      calculateFallbackRating({
        attendancePercentage: 95,
        verificationRate: 59,
      }).reasoning
    ).toContain('low verification rate');
  });
});
