import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('privileged route bundle security contract', () => {
  it('keeps privileged route imports out of App.jsx', () => {
    const app = read('src/App.jsx');

    expect(app).toContain(
      "const PrivilegedRoutes = lazy(() => import('./PrivilegedRoutes'));"
    );

    expect(app).not.toContain("import('./pages/admin/Reports')");
    expect(app).not.toContain("import('./pages/admin/Notices')");
    expect(app).not.toContain("import('./pages/admin/AdminDashboard')");
    expect(app).not.toContain("import('./pages/admin/AuditLog')");
    expect(app).not.toContain("import('./pages/admin/Certificates')");
  });

  it('keeps the privileged route map in its own module', () => {
    const privilegedRoutes = read('src/PrivilegedRoutes.jsx');

    expect(privilegedRoutes).toContain('useRoutes');
    expect(privilegedRoutes).toContain('/reports');
    expect(privilegedRoutes).toContain('/notices');
    expect(privilegedRoutes).toContain('/audit');
    expect(privilegedRoutes).toContain('/admin');
  });
});
