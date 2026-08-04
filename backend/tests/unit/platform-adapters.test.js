const fs = require('fs');
const path = require('path');

const twitterAdapter = require('../../src/modules/social-tasks/platform-adapters/twitter');
const linkedinAdapter = require('../../src/modules/social-tasks/platform-adapters/linkedin');
const { getAdapterForDomain } = require('../../src/modules/social-tasks/platform-adapters');
const { parseCount } = require('../../src/modules/social-tasks/platform-adapters/parse-count');

const FIXTURES_DIR = path.join(
  __dirname,
  '../../src/modules/social-tasks/platform-adapters/__fixtures__'
);

function loadFixture(platform, name) {
  return fs.readFileSync(path.join(FIXTURES_DIR, platform, name), 'utf8');
}

describe('parseCount', () => {
  it('parses plain integers', () => {
    expect(parseCount('256')).toBe(256);
  });

  it('parses comma-grouped integers', () => {
    expect(parseCount('1,234')).toBe(1234);
  });

  it('parses K/M/B abbreviations', () => {
    expect(parseCount('1.2K')).toBe(1200);
    expect(parseCount('3.4M')).toBe(3400000);
    expect(parseCount('2B')).toBe(2000000000);
  });

  it('returns null for unrecognizable or missing input', () => {
    expect(parseCount('')).toBeNull();
    expect(parseCount(null)).toBeNull();
    expect(parseCount(undefined)).toBeNull();
    expect(parseCount('not a count')).toBeNull();
  });
});

describe('twitter adapter', () => {
  it('extracts text and engagement counts from a standard post', () => {
    const html = loadFixture('twitter', 'standard-post.html');
    const result = twitterAdapter.parse(html);

    expect(result.text).toBe(
      'Just shipped a new feature for our onboarding flow. Excited to see how it performs! #buildinpublic'
    );
    expect(result.visibleSignals.likeCount).toBe(256);
    expect(result.visibleSignals.replyCount).toBe(12);
    expect(result.visibleSignals.repostCount).toBe(34);
    expect(result.visibleSignals.comments).toEqual([]);
  });

  it('returns text but null counts on a logged-out view', () => {
    const html = loadFixture('twitter', 'logged-out-view.html');
    const result = twitterAdapter.parse(html);

    expect(result.text).toContain('Logged-out visitors');
    expect(result.visibleSignals.likeCount).toBeNull();
    expect(result.visibleSignals.replyCount).toBeNull();
    expect(result.visibleSignals.repostCount).toBeNull();
  });

  it('returns null text and empty signals for a deleted/unavailable post, without throwing', () => {
    const html = loadFixture('twitter', 'deleted-post.html');

    expect(() => twitterAdapter.parse(html)).not.toThrow();

    const result = twitterAdapter.parse(html);
    expect(result.text).toBeNull();
    expect(result.visibleSignals.likeCount).toBeNull();
    expect(result.visibleSignals.comments).toEqual([]);
  });

  it('collects visible public replies as comments', () => {
    const html = loadFixture('twitter', 'post-with-comments.html');
    const result = twitterAdapter.parse(html);

    expect(result.text).toBe('Sharing our Q3 roadmap today — feedback welcome!');
    expect(result.visibleSignals.comments).toEqual([
      'Looks great, congrats on the launch!',
      'Any plans to expand to mobile?',
    ]);
  });

  it('parses abbreviated engagement counts (K/M)', () => {
    const html = loadFixture('twitter', 'abbreviated-metrics.html');
    const result = twitterAdapter.parse(html);

    expect(result.visibleSignals.replyCount).toBe(1200);
    expect(result.visibleSignals.repostCount).toBe(3400);
    expect(result.visibleSignals.likeCount).toBe(45600);
  });

  it('never throws on non-string or empty input', () => {
    expect(() => twitterAdapter.parse(null)).not.toThrow();
    expect(() => twitterAdapter.parse(undefined)).not.toThrow();
    expect(() => twitterAdapter.parse('')).not.toThrow();
    expect(() => twitterAdapter.parse('<not even html')).not.toThrow();

    const result = twitterAdapter.parse(null);
    expect(result.text).toBeNull();
  });
});

describe('linkedin adapter', () => {
  it('extracts text and engagement counts from a standard post', () => {
    const html = loadFixture('linkedin', 'standard-post.html');
    const result = linkedinAdapter.parse(html);

    expect(result.text).toBe(
      "Thrilled to share that our team just closed out a great quarter. Grateful for everyone who made it happen."
    );
    expect(result.visibleSignals.reactionCount).toBe(312);
    expect(result.visibleSignals.commentCount).toBe(18);
    expect(result.visibleSignals.shareCount).toBe(7);
  });

  it('returns text but null counts on a logged-out view', () => {
    const html = loadFixture('linkedin', 'logged-out-view.html');
    const result = linkedinAdapter.parse(html);

    expect(result.text).toContain('Sign in to see');
    expect(result.visibleSignals.reactionCount).toBeNull();
    expect(result.visibleSignals.commentCount).toBeNull();
    expect(result.visibleSignals.shareCount).toBeNull();
  });

  it('returns null text and empty signals for a deleted/unavailable post, without throwing', () => {
    const html = loadFixture('linkedin', 'deleted-post.html');

    expect(() => linkedinAdapter.parse(html)).not.toThrow();

    const result = linkedinAdapter.parse(html);
    expect(result.text).toBeNull();
    expect(result.visibleSignals.reactionCount).toBeNull();
    expect(result.visibleSignals.comments).toEqual([]);
  });

  it('collects visible public comments', () => {
    const html = loadFixture('linkedin', 'post-with-comments.html');
    const result = linkedinAdapter.parse(html);

    expect(result.visibleSignals.comments).toEqual([
      'Congrats on the growth!',
      'Is the design role remote-friendly?',
    ]);
  });

  it('parses abbreviated engagement counts (K)', () => {
    const html = loadFixture('linkedin', 'abbreviated-metrics.html');
    const result = linkedinAdapter.parse(html);

    expect(result.visibleSignals.reactionCount).toBe(1500);
    expect(result.visibleSignals.commentCount).toBe(243);
    expect(result.visibleSignals.shareCount).toBe(1100);
  });

  it('never throws on non-string or empty input', () => {
    expect(() => linkedinAdapter.parse(null)).not.toThrow();
    expect(() => linkedinAdapter.parse(undefined)).not.toThrow();
    expect(() => linkedinAdapter.parse('')).not.toThrow();
  });
});

describe('getAdapterForDomain', () => {
  it('resolves twitter.com and known variants to the twitter adapter', () => {
    expect(getAdapterForDomain('twitter.com')).toBe(twitterAdapter);
    expect(getAdapterForDomain('www.twitter.com')).toBe(twitterAdapter);
    expect(getAdapterForDomain('x.com')).toBe(twitterAdapter);
    expect(getAdapterForDomain('mobile.twitter.com')).toBe(twitterAdapter);
  });

  it('resolves linkedin.com and www variant to the linkedin adapter', () => {
    expect(getAdapterForDomain('linkedin.com')).toBe(linkedinAdapter);
    expect(getAdapterForDomain('www.linkedin.com')).toBe(linkedinAdapter);
  });

  it('is case-insensitive on hostname', () => {
    expect(getAdapterForDomain('LinkedIn.com')).toBe(linkedinAdapter);
  });

  it('returns null for an unregistered domain', () => {
    expect(getAdapterForDomain('facebook.com')).toBeNull();
  });

  it('returns null for missing/invalid hostname input, without throwing', () => {
    expect(() => getAdapterForDomain(null)).not.toThrow();
    expect(getAdapterForDomain(null)).toBeNull();
    expect(getAdapterForDomain(undefined)).toBeNull();
    expect(getAdapterForDomain('')).toBeNull();
  });
});
