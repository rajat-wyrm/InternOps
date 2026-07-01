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
});
