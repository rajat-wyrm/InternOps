import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
describe('View as User UI contract', () => {
  const team = read('src/pages/Team.jsx');
  const layout = read('src/layouts/DashboardLayout.jsx');
  const store = read('src/store/auth.js');
  const axios = read('src/lib/axios.js');
  it('offers a protected read-only flow and persistent exit banner', () => {
    expect(team).toContain('View as User');
    expect(team).toContain('Administrator password');
    expect(team).toContain('Reason for viewing this account');
    expect(layout).toContain('Exit User View');
    expect(layout).toContain('Read-only admin troubleshooting view');
  });
  it('keeps both temporary tokens memory-only and restores admin on exit or expiry', () => {
    expect(store).toContain('adminSession');
    expect(store).toContain('startImpersonation');
    expect(store).toContain('exitImpersonation');
    expect(axios).toContain('getState().exitImpersonation()');
    expect(store).not.toContain("safeSet('adminSession'");
  });
  it('keeps impersonation in memory during navigation and bypasses only the normal password redirect', () => {
    const app = read('src/App.jsx');
    expect(team).toContain("navigate('/dashboard', { replace: true })");
    expect(team).not.toContain("window.location.assign('/dashboard')");
    expect(app).toContain(
      'const impersonation = useAuthStore((s) => s.impersonation)'
    );
    expect(app).toContain('!impersonation');
  });
});
