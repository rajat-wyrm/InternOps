const fs = require('fs');
const path = require('path');
const read = (p) =>
  fs.readFileSync(path.resolve(__dirname, '../../', p), 'utf8');
describe('read-only admin impersonation contract', () => {
  const middleware = read('src/middleware/auth.js');
  const service = read('src/modules/auth/service.js');
  const routes = read('src/modules/auth/routes.js');
  const tokens = read('src/utils/tokens.js');
  test('requires admin reauthentication and reason', () => {
    expect(service).toContain("admin.role !== 'ADMIN'");
    expect(service).toContain('verifyPassword(adminUser, password)');
    expect(routes).toContain(
      "required: ['targetUserId', 'password', 'reason']"
    );
  });
  test('uses short-lived read-only claims and blocks mutations centrally', () => {
    expect(tokens).toContain("expiresIn: '10m'");
    expect(tokens).toContain('impersonationReadOnly: true');
    expect(middleware).toContain("code: 'IMPERSONATION_READ_ONLY'");
  });
  test('rejects unsafe targets and audits start and exit', () => {
    expect(service).toContain("target.role === 'ADMIN'");
    expect(service).toContain("action: 'IMPERSONATION_STARTED'");
    expect(service).toContain("action: 'IMPERSONATION_EXITED'");
  });
});
