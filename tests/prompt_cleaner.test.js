const {
  clean_and_parse_json,
} = require('../ai-service/app/utils/prompt_cleaner');

describe('clean_and_parse_json', () => {
  it('parses valid JSON', () => {
    const response = '{"score": 9, "reason": "Strong attendance"}';
    const parsed = clean_and_parse_json(response);
    expect(parsed.score).toBe(9);
  });

  it('strips markdown fences', () => {
    const response = '```json\n{"score": 7, "reason": "Needs focus"}\n```';
    const parsed = clean_and_parse_json(response);
    expect(parsed.score).toBe(7);
  });

  it('returns fallback on invalid JSON', () => {
    const response = 'Here is your evaluation:\n```json\n{bad json}\n```';
    const parsed = clean_and_parse_json(response);
    expect(parsed.score).toBeNull();
    expect(parsed.reason).toMatch(/Parsing failed/);
  });
});
