const { buildPrompt } = require('../../src/services/aiProviderService');

describe('AI provider prompt boundaries', () => {
  it('keeps system instructions and user content explicitly separated', () => {
    const prompt = buildPrompt([
      { role: 'system', content: 'Follow the application rules.' },
      { role: 'user', content: 'Write a concise notice.' },
    ]);

    expect(prompt).toContain('system: Follow the application rules.');
    expect(prompt).toContain('user: Write a concise notice.');
    expect(prompt.indexOf('system:')).toBeLessThan(prompt.indexOf('user:'));
  });
});
