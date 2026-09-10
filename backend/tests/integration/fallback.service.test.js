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

  it('assigns the correct reasoning tier for every attendance score', () => {
    const cases = [
      [50, 'weak attendance'],
      [60, 'average attendance'],
      [70, 'average attendance'],
      [80, 'strong attendance'],
      [90, 'strong attendance'],
      [95, 'strong attendance'],
    ];

    for (const [attendancePercentage, expectedReasoning] of cases) {
      const recommendation = calculateFallbackRating({
        attendancePercentage,
        verificationRate: 95,
      });

      expect(recommendation.reasoning).toContain(expectedReasoning);
    }
  });

  it('assigns the correct reasoning tier for every task score', () => {
    const cases = [
      [50, 'low verification rate'],
      [60, 'moderate task verification'],
      [70, 'moderate task verification'],
      [80, 'reliable task verification'],
      [90, 'reliable task verification'],
    ];

    for (const [verificationRate, expectedReasoning] of cases) {
      const recommendation = calculateFallbackRating({
        attendancePercentage: 95,
        verificationRate,
      });

      expect(recommendation.reasoning).toContain(expectedReasoning);
    }
  });
});
