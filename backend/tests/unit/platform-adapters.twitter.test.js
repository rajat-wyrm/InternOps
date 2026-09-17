const fs = require('fs');
const path = require('path');
const twitterAdapter = require('../../src/modules/social-tasks/platform-adapters/twitter');

const fixture = (name) =>
  fs.readFileSync(
    path.join(__dirname, '../fixtures/platform-adapters/twitter', name),
    'utf8'
  );

describe('Twitter/X platform adapter', () => {
  test('extracts post text', () => {
    const result = twitterAdapter.parse(fixture('post.html'));

    expect(result).not.toBeNull();
    expect(result.text).toBe('This is a sample public post from X.');
    expect(result.comments).toEqual([]);
  });

  test('extracts post text and visible counts', () => {
    const result = twitterAdapter.parse(fixture('post-with-counts.html'));

    expect(result.text).toBe(
      'Learning JavaScript and building great projects!'
    );
    expect(result.visibleSignals.likes).toBe('125');
    expect(result.visibleSignals.shares).toBe('24');
    expect(result.comments).toEqual([]);
  });

  test('extracts visible reply text as comments, separate from the post itself', () => {
    const result = twitterAdapter.parse(fixture('post-with-comments.html'));

    expect(result.text).toBe('Sharing my latest open-source contribution!');
    expect(result.visibleSignals.likes).toBe('301');
    expect(result.visibleSignals.shares).toBe('42');
    expect(result.comments).toEqual([
      'Nice work, congrats on shipping this!',
      'Following the repo, keep it up.',
    ]);
  });

  test('returns partial data when only some signals are visible', () => {
    const result = twitterAdapter.parse(fixture('partial.html'));

    expect(result.text).toBe('Reply visibility is limited on this post.');
    expect(result.visibleSignals.likes).toBe('9');
    expect(result.visibleSignals.shares).toBeNull();
    expect(result.comments).toEqual([]);
  });

  test('returns partial data when post content is unavailable', () => {
    const result = twitterAdapter.parse(fixture('empty.html'));

    expect(result).not.toBeNull();
    expect(result.text).toBeNull();
    expect(result.comments).toEqual([]);
    expect(result.visibleSignals.likes).toBeNull();
    expect(result.visibleSignals.shares).toBeNull();
  });

  test('returns null for invalid input', () => {
    expect(twitterAdapter.parse('')).toBeNull();
    expect(twitterAdapter.parse(null)).toBeNull();
    expect(twitterAdapter.parse(undefined)).toBeNull();
    expect(twitterAdapter.parse(42)).toBeNull();
  });

  test('never throws on malformed markup', () => {
    expect(() => twitterAdapter.parse('<div><span>unterminated')).not.toThrow();
    expect(() => twitterAdapter.parse('<<<not html at all>>>')).not.toThrow();
  });
});
