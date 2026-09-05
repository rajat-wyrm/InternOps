const fs = require('fs');
const path = require('path');

describe('authentication cookie contract', () => {
  const routes = fs.readFileSync(
    path.resolve(__dirname, '../../src/modules/auth/routes.js'),
    'utf8'
  );
  const csrf = fs.readFileSync(
    path.resolve(__dirname, '../../src/middleware/csrf.js'),
    'utf8'
  );
  const config = fs.readFileSync(
    path.resolve(__dirname, '../../src/config/index.js'),
    'utf8'
  );

  test('uses one cookie configuration for refresh and CSRF', () => {
    expect(config).toContain('cookie: buildCookieConfig()');
    expect(routes).toContain('...config.cookie');
    expect(csrf).toContain('secure: config.cookie.secure');
    expect(csrf).toContain('sameSite: config.cookie.sameSite');
  });

  test('reports a missing refresh cookie without token values', () => {
    expect(routes).toContain("code: 'REFRESH_COOKIE_MISSING'");
    expect(routes).toContain('cookieNames: Object.keys(req.cookies || {})');
    expect(routes).not.toContain('refreshToken: token');
  });
});
