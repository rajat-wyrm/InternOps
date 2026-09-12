import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const axiosSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/lib/axios.js'),
  'utf8'
);
const authSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/store/auth.js'),
  'utf8'
);

describe('safe refresh storage contract', () => {
  it('keeps access tokens memory-only and preserves cached user at startup', () => {
    expect(authSource).toContain("safeRemove('accessToken')");
    expect(authSource).toContain("safeSet('user', JSON.stringify(user))");
    const registration = axiosSource.slice(
      axiosSource.indexOf('export function registerAuthStore'),
      axiosSource.indexOf('function getMemoryAccessToken')
    );
    expect(registration).not.toContain('removeLegacyAuthStorage()');
  });

  it('coordinates refresh rotation and ignores stale failures', () => {
    expect(axiosSource).toContain('let sharedRefreshPromise = null');
    expect(axiosSource).toContain('navigator.locks.request(');
    expect(axiosSource).toContain("'internops-refresh-token'");
    expect(axiosSource).toContain('current.authGeneration === generation');
    expect(axiosSource).toContain('export function refreshSession()');
    expect(authSource).toContain('authGeneration: 0');
    expect(authSource).toContain('authGeneration: prev.authGeneration + 1');
  });
});
