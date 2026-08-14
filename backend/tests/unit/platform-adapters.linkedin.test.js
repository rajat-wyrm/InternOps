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
  });

  test('extracts post text and visible counts', () => {
    const result = linkedinAdapter.parse(fixture('post-with-counts.html'));

    expect(result.text).toBe(
      'Building projects and learning new technologies!'
    );
    expect(result.visibleSignals.likes).toBe('85');
    expect(result.visibleSignals.shares).toBe('12');
  });

  test('returns partial data when post content is unavailable', () => {
    const result = linkedinAdapter.parse(fixture('empty.html'));

    expect(result).not.toBeNull();
    expect(result.text).toBeNull();
    expect(result.visibleSignals.likes).toBeNull();
    expect(result.visibleSignals.shares).toBeNull();
  });

  test('returns null for invalid input', () => {
    expect(linkedinAdapter.parse('')).toBeNull();
    expect(linkedinAdapter.parse(null)).toBeNull();
  });
});
