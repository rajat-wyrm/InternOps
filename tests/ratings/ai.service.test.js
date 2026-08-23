// Mock Gemini so tests don't hit the real API.
//
// The client is constructed once at module load time
// (`const genAI = new GoogleGenerativeAI(...)` in ai.service.js), so simply
// reassigning `GoogleGenerativeAI.mockImplementation(...)` after the module
// has already been required has no effect on the already-built instance.
// To get a fresh, per-test mocked response we reset the module registry and
// re-require the service under test for every test case.
function loadService(mockResponse) {
  jest.resetModules();
  jest.doMock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockResolvedValue(mockResponse),
      }),
    })),
  }));

  // eslint-disable-next-line global-require
  return require('../../backend/src/modules/ratings/ai.service');
}

describe('generateRatingSuggestion', () => {
  it('returns valid score and feedback when AI response is correct', async () => {
    const { generateRatingSuggestion } = loadService({
      response: {
        text: () =>
          '{"score":8,"feedback":"Consistent performance and good attendance throughout the review period this month"}',
        usageMetadata: { totalTokenCount: 42 },
      },
    });

    const mockData = {
      user: { id: '123', role: 'intern' },
      metrics: { attendancePercentage: 90, verificationRate: 80 },
    };

    const result = await generateRatingSuggestion(mockData);

    expect(result.source).toBe('ai');
    expect(result.suggestedScore).toBe(8);
    expect(result.feedback).toMatch(/Consistent performance/);
  });

  it('handles invalid JSON gracefully', async () => {
    const { generateRatingSuggestion } = loadService({
      response: { text: () => '{bad json}' },
    });

    const badData = { user: { id: 'bad' }, metrics: {} };
    const result = await generateRatingSuggestion(badData);

    expect(result.suggestedScore).toBeNull();
    expect(result.feedback).toMatch(/Invalid|Missing|Parsing failed/);
  });

  it('flags feedback that is under MIN_FEEDBACK_WORDS instead of passing it through', async () => {
    const { generateRatingSuggestion } = loadService({
      response: { text: () => '{"score":7,"feedback":"Too short"}' },
    });

    const mockData = { user: { id: '1' }, metrics: {} };
    const result = await generateRatingSuggestion(mockData);

    expect(result.source).toBe('ai');
    expect(result.suggestedScore).toBe(7);
    expect(result.feedback).toMatch(/too short/i);
    // The under-length feedback itself must not pass through unmodified.
    expect(result.feedback).not.toBe('Too short');
  });

  it('truncates feedback that is over MAX_FEEDBACK_WORDS', async () => {
    const longFeedback = Array.from({ length: 20 }, (_, i) => `word${i}`).join(
      ' '
    );
    const { generateRatingSuggestion } = loadService({
      response: {
        text: () => JSON.stringify({ score: 6, feedback: longFeedback }),
      },
    });

    const mockData = { user: { id: '1' }, metrics: {} };
    const result = await generateRatingSuggestion(mockData);

    expect(result.source).toBe('ai');
    expect(result.suggestedScore).toBe(6);
    expect(result.feedback.split(/\s+/).length).toBe(15);
    expect(result.feedback).toBe(
      longFeedback.split(/\s+/).slice(0, 15).join(' ')
    );
  });

  it('passes through feedback that is within the allowed word range', async () => {
    const inRangeFeedback =
      'Solid consistent output with good attendance and reliable task verification';
    const { generateRatingSuggestion } = loadService({
      response: {
        text: () => JSON.stringify({ score: 9, feedback: inRangeFeedback }),
      },
    });

    const mockData = { user: { id: '1' }, metrics: {} };
    const result = await generateRatingSuggestion(mockData);

    expect(result.source).toBe('ai');
    expect(result.suggestedScore).toBe(9);
    expect(result.feedback).toBe(inRangeFeedback);
  });
});
