const fs = require('fs');
const path = require('path');
const linkedinAdapter = require('../../src/modules/social-tasks/platform-adapters/linkedin');

const fixture = (name) =>
  fs.readFileSync(
    path.join(__dirname, '../fixtures/platform-adapters/linkedin', name),
    'utf8'
  );

describe('LinkedIn platform adapter', () => {
  test('extracts post text', () => {
    const result = linkedinAdapter.parse(fixture('post.html'));

    expect(result).not.toBeNull();
    expect(result.text).toBe('This is a sample LinkedIn post for testing.');
    expect(result.comments).toEqual([]);
  });

  test('extracts post text and visible counts', () => {
    const result = linkedinAdapter.parse(fixture('post-with-counts.html'));

    expect(result.text).toBe(
      'Building projects and learning new technologies!'
    );
    expect(result.visibleSignals.likes).toBe('85');
    expect(result.visibleSignals.shares).toBe('12');
    expect(result.comments).toEqual([]);
  });

  test('extracts visible comment text, separate from the post itself', () => {
    const result = linkedinAdapter.parse(fixture('post-with-comments.html'));

    expect(result.text).toBe('Excited to share our new internship program!');
    expect(result.visibleSignals.likes).toBe('214');
    expect(result.visibleSignals.shares).toBe('18');
    expect(result.comments).toEqual([
      'Congrats, this looks like a great opportunity!',
      'Applying today.',
    ]);
  });

  test('returns partial data when only some signals are visible', () => {
    const result = linkedinAdapter.parse(fixture('partial.html'));

    expect(result.text).toBe('Comments are turned off for this post.');
    expect(result.visibleSignals.likes).toBe('7');
    expect(result.visibleSignals.shares).toBeNull();
    expect(result.comments).toEqual([]);
  });

  test('returns partial data when post content is unavailable', () => {
    const result = linkedinAdapter.parse(fixture('empty.html'));

    expect(result).not.toBeNull();
    expect(result.text).toBeNull();
    expect(result.comments).toEqual([]);
    expect(result.visibleSignals.likes).toBeNull();
    expect(result.visibleSignals.shares).toBeNull();
  });

  test('returns null for invalid input', () => {
    expect(linkedinAdapter.parse('')).toBeNull();
    expect(linkedinAdapter.parse(null)).toBeNull();
    expect(linkedinAdapter.parse(undefined)).toBeNull();
    expect(linkedinAdapter.parse(42)).toBeNull();
  });

  test('never throws on malformed markup', () => {
    expect(() =>
      linkedinAdapter.parse('<div><span>unterminated')
    ).not.toThrow();
    expect(() => linkedinAdapter.parse('<<<not html at all>>>')).not.toThrow();
  });
});
