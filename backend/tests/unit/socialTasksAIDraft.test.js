const {
  generateTaskDraft,
  normalizeDraft,
  safeSandbox,
} = require('../../src/modules/social-tasks/ai-draft.service');

const { generateAIResponse } = require('../../src/services/aiProviderService');

jest.mock('../../src/services/aiProviderService', () => ({
  generateAIResponse: jest.fn(),
}));

describe('Social Tasks AI Draft Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('safeSandbox', () => {
    it('sanitizes control characters and collapses whitespace', () => {
      const untrusted = 'get\u0000interns  to\n\nrepost';
      expect(safeSandbox(untrusted)).toBe('get interns to repost');
    });

    it('truncates to max length', () => {
      expect(safeSandbox('a'.repeat(600), 500)).toHaveLength(500);
    });

    it('handles non-string values gracefully', () => {
      expect(safeSandbox(null)).toBe('');
      expect(safeSandbox(undefined)).toBe('');
      expect(safeSandbox(42)).toBe('42');
    });
  });

  describe('normalizeDraft', () => {
    it('passes through a well-formed draft', () => {
      const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const parsed = {
        title: 'Repost the product launch',
        description: 'Ask interns to repost the new launch announcement.',
        proofRequirements: 'Screenshot of the repost with visible handle.',
        suggestedDeadline: future.toISOString(),
      };

      const result = normalizeDraft(parsed);
      expect(result.title).toBe(parsed.title);
      expect(result.description).toBe(parsed.description);
      expect(result.proofRequirements).toBe(parsed.proofRequirements);
      expect(result.suggestedDeadline).toBe(future.toISOString());
    });

    it('joins array-shaped proof requirements into one string', () => {
      const result = normalizeDraft({
        title: 'Task',
        proofRequirements: ['Screenshot of the post', 'Link to the profile'],
      });
      expect(result.proofRequirements).toBe(
        'Screenshot of the post\n- Link to the profile'
      );
    });

    it('falls back to a default title when missing', () => {
      const result = normalizeDraft({});
      expect(result.title).toBe('Untitled Task');
    });

    it('defaults the deadline when missing, unparsable, or in the past', () => {
      const missing = normalizeDraft({});
      const invalid = normalizeDraft({ suggestedDeadline: 'not-a-date' });
      const past = normalizeDraft({
        suggestedDeadline: new Date(Date.now() - 86400000).toISOString(),
      });

      for (const result of [missing, invalid, past]) {
        expect(new Date(result.suggestedDeadline).getTime()).toBeGreaterThan(
          Date.now()
        );
      }
    });
  });

  describe('generateTaskDraft', () => {
    it('returns a normalized draft when the provider call succeeds', async () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const mockContent = JSON.stringify({
        title: 'Repost the product launch',
        description: 'Get interns to repost the new product launch post.',
        proofRequirements: 'Screenshot showing the repost is public.',
        suggestedDeadline: future.toISOString(),
      });

      generateAIResponse.mockResolvedValueOnce({
        content: mockContent,
        provider: 'mock-gemini',
      });

      const result = await generateTaskDraft({
        brief: 'get interns to repost the new product launch',
        creatorId: 'creator-1',
      });

      expect(result.title).toBe('Repost the product launch');
      expect(result.provider).toBe('mock-gemini');
      expect(generateAIResponse).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'creator-1' })
      );
    });

    it('strips markdown code fences before parsing', async () => {
      generateAIResponse.mockResolvedValueOnce({
        content: '```json\n{"title": "Repost campaign"}\n```',
        provider: 'mock-gemini',
      });

      const result = await generateTaskDraft({
        brief: 'repost campaign',
        creatorId: 'creator-1',
      });

      expect(result.title).toBe('Repost campaign');
    });

    it('rejects an empty or whitespace-only brief without calling the provider', async () => {
      await expect(
        generateTaskDraft({ brief: '   ', creatorId: 'creator-1' })
      ).rejects.toThrow('Brief is required');

      expect(generateAIResponse).not.toHaveBeenCalled();
    });

    it('throws when the AI response is not valid JSON', async () => {
      generateAIResponse.mockResolvedValueOnce({
        content: 'not valid json',
        provider: 'mock-gemini',
      });

      await expect(
        generateTaskDraft({ brief: 'repost campaign', creatorId: 'creator-1' })
      ).rejects.toThrow('AI returned an invalid draft');
    });

    it('throws when the AI response is valid JSON but not an object', async () => {
      generateAIResponse.mockResolvedValueOnce({
        content: '["title", "description"]',
        provider: 'mock-gemini',
      });

      await expect(
        generateTaskDraft({ brief: 'repost campaign', creatorId: 'creator-1' })
      ).rejects.toThrow('AI returned an invalid draft');
    });

    it('propagates provider errors (e.g. all providers unavailable)', async () => {
      generateAIResponse.mockRejectedValueOnce(
        new Error('All AI providers unavailable')
      );

      await expect(
        generateTaskDraft({ brief: 'repost campaign', creatorId: 'creator-1' })
      ).rejects.toThrow('All AI providers unavailable');
    });
  });
});
