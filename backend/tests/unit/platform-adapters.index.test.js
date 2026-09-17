const {
  getAdapterForDomain,
} = require('../../src/modules/social-tasks/platform-adapters');

describe('Platform adapter domain lookup', () => {
  test('returns Twitter adapter for twitter.com', () => {
    const adapter = getAdapterForDomain('twitter.com');

    expect(adapter).not.toBeNull();
    expect(adapter.domain).toBe('twitter.com');
  });

  test('returns Twitter adapter for x.com', () => {
    const adapter = getAdapterForDomain('x.com');

    expect(adapter).not.toBeNull();
    expect(adapter.domain).toBe('twitter.com');
  });

  test('handles uppercase hostnames', () => {
    const adapter = getAdapterForDomain('WWW.TWITTER.COM');

    expect(adapter).not.toBeNull();
    expect(adapter.domain).toBe('twitter.com');
  });
  test('returns LinkedIn adapter for linkedin.com', () => {
    const adapter = getAdapterForDomain('linkedin.com');

    expect(adapter).not.toBeNull();
    expect(adapter.domain).toBe('linkedin.com');
  });

  test('returns LinkedIn adapter for www.linkedin.com', () => {
    const adapter = getAdapterForDomain('www.linkedin.com');

    expect(adapter).not.toBeNull();
    expect(adapter.domain).toBe('linkedin.com');
  });

  test('returns null for unsupported domains', () => {
    expect(getAdapterForDomain('facebook.com')).toBeNull();
  });

  test('returns null for invalid input', () => {
    expect(getAdapterForDomain(null)).toBeNull();
    expect(getAdapterForDomain('')).toBeNull();
  });
});
