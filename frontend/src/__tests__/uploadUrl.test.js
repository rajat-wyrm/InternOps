import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveUploadUrl } from '../lib/uploadUrl';

describe('resolveUploadUrl', () => {
  const originalEnv = import.meta.env.VITE_API_URL;

  afterEach(() => {
    import.meta.env.VITE_API_URL = originalEnv;
  });

  beforeEach(() => {
    import.meta.env.VITE_API_URL = 'https://api.example.com';
  });

  it('returns null for empty input', () => {
    expect(resolveUploadUrl(null)).toBeNull();
    expect(resolveUploadUrl('')).toBeNull();
    expect(resolveUploadUrl(undefined)).toBeNull();
  });

  it('prefixes the API origin for root-relative upload paths', () => {
    expect(resolveUploadUrl('/uploads/avatar_1.png')).toBe(
      'https://api.example.com/uploads/avatar_1.png'
    );
  });

  it('strips a versioned API suffix from VITE_API_URL', () => {
    import.meta.env.VITE_API_URL = 'https://api.example.com/api/v1';
    expect(resolveUploadUrl('/uploads/a.png')).toBe(
      'https://api.example.com/uploads/a.png'
    );
  });

  it('handles trailing slashes and missing protocol', () => {
    import.meta.env.VITE_API_URL = 'api.example.com/';
    expect(resolveUploadUrl('/uploads/a.png')).toBe(
      'http://api.example.com/uploads/a.png'
    );
  });

  it('leaves absolute URLs untouched', () => {
    const abs = 'https://cdn.example.com/pic.png';
    expect(resolveUploadUrl(abs)).toBe(abs);
    expect(resolveUploadUrl('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA'
    );
  });

  it('keeps paths relative when VITE_API_URL is unset (dev proxy)', () => {
    import.meta.env.VITE_API_URL = '';
    expect(resolveUploadUrl('/uploads/a.png')).toBe('/uploads/a.png');
  });
});
