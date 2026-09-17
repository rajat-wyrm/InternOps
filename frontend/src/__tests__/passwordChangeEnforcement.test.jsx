import { describe, expect, test } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (relative) =>
  fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

describe('first-login password enforcement', () => {
  test('blocks protected routes until the password is changed', () => {
    const source = read('App.jsx');
    expect(source).toContain('user?.mustChangePassword');
    expect(source).toContain("window.location.pathname !== '/profile'");
    expect(source).toContain('<Navigate to="/profile" replace />');
  });

  test('skips protected feature flags while a password change is required', () => {
    const source = read('App.jsx');
    expect(source).toContain('if (refreshedUser?.mustChangePassword)');
    expect(source).toContain('resetFlags();');
    expect(source).toMatch(/Promise\.resolve\(fetchFlags\(\)\)\.catch/);
    expect(source.indexOf('resetFlags();')).toBeLessThan(
      source.indexOf('Promise.resolve(fetchFlags())')
    );
  });

  test('pauses protected layout background activity until password change', () => {
    const source = read('layouts/DashboardLayout.jsx');
    expect(source).toContain(
      'if (!accessToken || user?.mustChangePassword) return undefined;'
    );
    expect(source).toMatch(
      /enabled:\s*!!accessToken\s*&&\s*isDepartmentScopedRole\s*&&\s*!user\?\.mustChangePassword/
    );
    expect(source).toMatch(
      /enabled:\s*!!accessToken\s*&&\s*!!user\s*&&\s*!user\?\.mustChangePassword/
    );
    expect(source).toContain(
      '[accessToken, queryClient, user?.mustChangePassword]'
    );
  });

  test('redirects temporary-password login to Profile', () => {
    const source = read('pages/Login.jsx');
    expect(source).toMatch(
      /navigate\(data\.user\?\.mustChangePassword\s*\?\s*['"]\/profile['"]\s*:\s*safeDestination/
    );
    expect(source).toContain('replace: true');
  });

  test('shows instructions and clears the local flag after success', () => {
    const source = read('pages/Profile.jsx');
    expect(source).toContain('Password change required');
    expect(source).toContain('mustChangePassword: false');
    const successBlock = source.indexOf(
      "flash('Password changed successfully')"
    );
    const clearFlag = source.indexOf('mustChangePassword: false');
    expect(successBlock).toBeGreaterThan(-1);
    expect(clearFlag).toBeGreaterThan(successBlock);
    expect(source).toContain('await fetchFlags();');
    expect(source.indexOf('await fetchFlags();')).toBeGreaterThan(clearFlag);
  });
});
