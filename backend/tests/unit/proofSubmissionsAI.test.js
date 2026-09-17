const {
  generateTaskSummary,
  calculateFallbackSummary,
  safeSandbox,
} = require('../../src/modules/proof-submissions/ai.service');

const { generateAIResponse } = require('../../src/services/aiProviderService');

jest.mock('../../src/services/aiProviderService', () => ({
  generateAIResponse: jest.fn(),
}));

describe('Proof Submissions AI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('safeSandbox', () => {
    it('sanitizes control characters and spaces', () => {
      const untrusted = 'hello\u0000world  \n  test';
      expect(safeSandbox(untrusted)).toBe('hello world test');
    });

    it('truncates to max length', () => {
      const longStr = 'a'.repeat(300);
      expect(safeSandbox(longStr, 50)).toHaveLength(50);
    });

    it('handles non-string values gracefully', () => {
      expect(safeSandbox(null)).toBe('');
      expect(safeSandbox(undefined)).toBe('');
      expect(safeSandbox(123)).toBe('123');
    });
  });

  describe('calculateFallbackSummary', () => {
    it('flags submission for review if no actions are claimed', () => {
      const submission = {
        did_comment: false,
        did_repost: false,
        did_share: false,
        target_platform: 'LinkedIn',
        task_link: 'http://example.com',
      };

      const result = calculateFallbackSummary(submission);
      expect(result.source).toBe('fallback');
      expect(result.consistencyFlag).toBe('needs_review');
      expect(result.summary).toContain('No actions claimed');
    });

    it('flags submission for review if platform is missing', () => {
      const submission = {
        did_comment: true,
        did_repost: false,
        did_share: false,
        target_platform: '',
        task_link: 'http://example.com',
      };

      const result = calculateFallbackSummary(submission);
      expect(result.consistencyFlag).toBe('needs_review');
    });

    it('returns ok flag if actions and platform are set', () => {
      const submission = {
        did_comment: true,
        did_repost: false,
        did_share: false,
        target_platform: 'LinkedIn',
        task_link: 'http://example.com',
      };

      const result = calculateFallbackSummary(submission);
      expect(result.consistencyFlag).toBe('ok');
      expect(result.summary).toContain('Claims Comment on LinkedIn');
    });
  });

  describe('generateTaskSummary', () => {
    it('returns AI summary when provider call succeeds', async () => {
      const mockContent = JSON.stringify({
        summary: 'Claims comment action on LinkedIn.',
        consistencyFlag: 'ok',
      });

      generateAIResponse.mockResolvedValueOnce({
        content: mockContent,
        provider: 'mock-gemini',
      });

      const submission = {
        did_comment: true,
        target_platform: 'LinkedIn',
        task_link: 'http://example.com',
      };

      const result = await generateTaskSummary(submission, 'reviewer-id');
      expect(result.source).toBe('ai');
      expect(result.summary).toBe('Claims comment action on LinkedIn.');
      expect(result.consistencyFlag).toBe('ok');
      expect(generateAIResponse).toHaveBeenCalled();
    });

    it('falls back to rule-based summary when provider fails', async () => {
      generateAIResponse.mockRejectedValueOnce(new Error('API Error'));

      const submission = {
        did_comment: true,
        target_platform: 'LinkedIn',
        task_link: 'http://example.com',
      };

      const result = await generateTaskSummary(submission, 'reviewer-id');
      expect(result.source).toBe('fallback');
      expect(result.consistencyFlag).toBe('ok');
      expect(result.summary).toContain(
        'Fallback summary: Claims Comment on LinkedIn.'
      );
    });

    it('falls back when AI returns invalid JSON', async () => {
      generateAIResponse.mockResolvedValueOnce({
        content: 'not valid json',
        provider: 'mock-gemini',
      });

      const submission = {
        did_comment: true,
        target_platform: 'LinkedIn',
        task_link: 'http://example.com',
      };

      const result = await generateTaskSummary(submission, 'reviewer-id');
      expect(result.source).toBe('fallback');
      expect(result.consistencyFlag).toBe('ok');
    });

    it('truncates summaries that exceed 30 words', async () => {
      const longSummary = 'a '.repeat(40).trim();
      const mockContent = JSON.stringify({
        summary: longSummary,
        consistencyFlag: 'ok',
      });

      generateAIResponse.mockResolvedValueOnce({
        content: mockContent,
        provider: 'mock-gemini',
      });

      const submission = {
        did_comment: true,
        target_platform: 'LinkedIn',
        task_link: 'http://example.com',
      };

      const result = await generateTaskSummary(submission, 'reviewer-id');
      expect(result.source).toBe('ai');
      const wordCount = result.summary.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBe(30);
    });

    it('normalizes invalid consistencyFlag to needs_review', async () => {
      const mockContent = JSON.stringify({
        summary: 'Invalid flag test.',
        consistencyFlag: 'invalid_status',
      });

      generateAIResponse.mockResolvedValueOnce({
        content: mockContent,
        provider: 'mock-gemini',
      });

      const submission = {
        did_comment: true,
        target_platform: 'LinkedIn',
        task_link: 'http://example.com',
      };

      const result = await generateTaskSummary(submission, 'reviewer-id');
      expect(result.consistencyFlag).toBe('needs_review');
    });
  });
});
