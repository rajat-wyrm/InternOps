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
    expect(source).toContain('await fetchFlags();');
    expect(source.indexOf('resetFlags();')).toBeLessThan(
      source.indexOf('await fetchFlags();')
    );
  });

  test('pauses protected layout background activity until password change', () => {
    const source = read('layouts/DashboardLayout.jsx');
    expect(source).toContain(
      'if (!accessToken || user?.mustChangePassword) return undefined;'
    );
    expect(source).toContain(
      'enabled: isDepartmentScopedRole && !user?.mustChangePassword'
    );
    expect(source).toContain('enabled: !!user && !user?.mustChangePassword');
    expect(source).toContain(
      '[accessToken, queryClient, user?.mustChangePassword]'
    );
  });

  test('redirects temporary-password login to Profile', () => {
    const source = read('pages/Login.jsx');
    expect(source).toContain(
      "navigate(data.user?.mustChangePassword ? '/profile' : '/')"
    );
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
