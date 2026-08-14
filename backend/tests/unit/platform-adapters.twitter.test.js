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
  });

  test('extracts post text and visible counts', () => {
    const result = twitterAdapter.parse(fixture('post-with-counts.html'));

    expect(result.text).toBe(
      'Learning JavaScript and building great projects!'
    );
    expect(result.visibleSignals.likes).toBe('125');
    expect(result.visibleSignals.shares).toBe('24');
  });

  test('returns partial data when post content is unavailable', () => {
    const result = twitterAdapter.parse(fixture('empty.html'));

    expect(result).not.toBeNull();
    expect(result.text).toBeNull();
    expect(result.visibleSignals.likes).toBeNull();
    expect(result.visibleSignals.shares).toBeNull();
  });

  test('returns null for invalid input', () => {
    expect(twitterAdapter.parse('')).toBeNull();
    expect(twitterAdapter.parse(null)).toBeNull();
  });
});
