jest.mock('../../src/utils/tokens', () => ({
  verifyAccessToken: jest.fn(),
}));
jest.mock('../../src/config/redis', () => ({
  isAccessTokenBlacklisted: jest.fn(async () => false),
  blacklistAccessToken: jest.fn(),
}));
jest.mock('../../src/modules/auth/repository', () => ({
  getPasswordAccessState: jest.fn(),
}));

const { verifyAccessToken } = require('../../src/utils/tokens');
const repository = require('../../src/modules/auth/repository');
const auth = require('../../src/middleware/auth');

function request(method, route) {
  return {
    method,
    headers: { authorization: 'Bearer test-token' },
    routeOptions: { url: route },
  };
}
function reply() {
  return {
    statusCode: 200,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    send: jest.fn(function send(payload) {
      this.payload = payload;
      return payload;
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  verifyAccessToken.mockReturnValue({
    id: 'user-1',
    role: 'INTERN',
    departmentId: 'department-1',
    typ: 'access',
    jti: 'jti-1',
    exp: 9999999999,
  });
});

test('blocks a normal protected API while password change is required', async () => {
  repository.getPasswordAccessState.mockResolvedValue({
    must_change_password: true,
    suspended: false,
  });
  const req = request('GET', '/api/v1/attendance');
  const res = reply();
  await auth(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.payload).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
});

test.each([
  ['GET', '/api/v1/users/me'],
  ['PATCH', '/api/v1/users/me/password'],
  ['POST', '/api/v1/auth/logout'],
])('allows %s %s during mandatory password change', async (method, route) => {
  repository.getPasswordAccessState.mockResolvedValue({
    must_change_password: true,
    suspended: false,
  });
  const req = request(method, route);
  const res = reply();
  await auth(req, res);
  expect(res.status).not.toHaveBeenCalled();
  expect(req.user.mustChangePassword).toBe(true);
});

test('allows normal APIs after password change', async () => {
  repository.getPasswordAccessState.mockResolvedValue({
    must_change_password: false,
    suspended: false,
  });
  const req = request('GET', '/api/v1/attendance');
  const res = reply();
  await auth(req, res);
  expect(res.status).not.toHaveBeenCalled();
  expect(req.user.mustChangePassword).toBe(false);
});
