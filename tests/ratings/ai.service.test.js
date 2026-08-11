// Mock Gemini so tests don't hit the real API
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () =>
            '{"score":8,"feedback":"Consistent performance and good attendance"}',
          usageMetadata: { totalTokenCount: 42 },
        },
      }),
    }),
  })),
}));

const {
  generateRatingSuggestion,
} = require('../../backend/src/modules/ratings/ai.service');

describe('generateRatingSuggestion', () => {
  it('returns valid score and feedback when AI response is correct', async () => {
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
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => '{bad json}' },
        }),
      }),
    }));

    const badData = { user: { id: 'bad' }, metrics: {} };
    const result = await generateRatingSuggestion(badData);

    expect(result.suggestedScore).toBeNull();
    expect(result.feedback).toMatch(/Invalid|Missing|Parsing failed/);
  });
});
