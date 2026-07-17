jest.mock('../../src/modules/auth/repository', () => ({
  findByIdRaw: jest.fn(),
  createUser: jest.fn(),
  findByEmail: jest.fn(),
  verifyPassword: jest.fn(),
  storeRefreshTokenRedis: jest.fn(),
  claimRefreshToken: jest.fn(),
  findById: jest.fn(),
  revokeRefreshTokenRedis: jest.fn(),
  revokeAllUserTokensRedis: jest.fn(),
}));

jest.mock('../../src/utils/errors', () => ({
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message) {
      super(message);
      this.name = 'UnauthorizedError';
    }
  },
}));

jest.mock('../../src/utils/tokens', () => ({
  generateAccessToken: jest.fn().mockReturnValue('mocked-access-token'),
  generateRefreshToken: jest.fn().mockReturnValue('mocked-refresh-token'),
  hashToken: jest.fn((token) => `mocked-hash:${token}`),
  verifyRefreshToken: jest.fn((token) => ({ id: 'user-1' })),
}));

jest.mock('../../src/utils/audit', () => ({
  createAuditLog: jest.fn(),
}));

jest.mock('../../src/middleware/bruteForce', () => ({
  recordLoginAttempt: jest.fn().mockResolvedValue(undefined),
  clearFailedAttempts: jest.fn().mockResolvedValue(undefined),
  incrementAttempt: jest.fn(),
}));

jest.mock('../../src/utils/hierarchy', () => ({
  isValidStep: jest.fn(),
}));

jest.mock('../../src/modules/auth/verificationService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/config/redis', () => ({
  blacklistAccessToken: jest.fn(),
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue('1'),
    set: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
}));

const repo = require('../../src/modules/auth/repository');
const { UnauthorizedError } = require('../../src/utils/errors');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} = require('../../src/utils/tokens');
const { createAuditLog } = require('../../src/utils/audit');
const {
  recordLoginAttempt,
  clearFailedAttempts,
  incrementAttempt,
} = require('../../src/middleware/bruteForce');
const { isValidStep } = require('../../src/utils/hierarchy');
const {
  sendVerificationEmail,
} = require('../../src/modules/auth/verificationService');
const { blacklistAccessToken } = require('../../src/config/redis');
const argon2 = require('argon2');
const service = require('../../src/modules/auth/service');

describe('Auth Service', () => {
  const creator = { id: 'creator-1' };
  const email = 'test@example.com';
  const password = 'TestPassword123!';
  const ip = '127.0.0.1';
  const userAgent = 'jest-agent';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register()', () => {
    it('register() success', async () => {
      const manager = { id: 'manager-1', role: 'MANAGER' };
      const newUser = {
        id: 'user-1',
        email,
        role: 'EMPLOYEE',
        full_name: 'Test User',
      };
      const data = { email, role: 'EMPLOYEE', managerId: 'manager-1' };

      repo.findByIdRaw.mockResolvedValue(manager);
      isValidStep.mockReturnValue(true);
      repo.createUser.mockResolvedValue(newUser);

      const result = await service.register(data, creator);

      expect(repo.findByIdRaw).toHaveBeenCalledWith('manager-1');
      expect(isValidStep).toHaveBeenCalledWith(manager.role, data.role);
      expect(repo.createUser).toHaveBeenCalledWith({
        ...data,
        managerId: 'manager-1',
      });
      expect(createAuditLog).toHaveBeenCalledWith({
        userId: creator.id,
        action: 'USER_CREATED',
        resourceType: 'user',
        resourceId: newUser.id,
        details: { email: newUser.email, role: newUser.role },
      });
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        newUser.id,
        newUser.email
      );
      expect(result).toEqual(newUser);
    });

    it('register() invalid hierarchy', async () => {
      const manager = { id: 'manager-1', role: 'MANAGER' };
      const data = { email, role: 'EMPLOYEE', managerId: 'manager-1' };

      repo.findByIdRaw.mockResolvedValue(manager);
      isValidStep.mockReturnValue(false);

      await expect(service.register(data, creator)).rejects.toThrow(
        'Invalid hierarchy: MANAGER cannot manage EMPLOYEE'
      );
      expect(repo.createUser).not.toHaveBeenCalled();
    });

    it('register() manager not found', async () => {
      const data = { email, role: 'EMPLOYEE', managerId: 'manager-1' };

      repo.findByIdRaw.mockResolvedValue(null);

      await expect(service.register(data, creator)).rejects.toThrow(
        'Manager not found'
      );
      expect(repo.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    it('login() success', async () => {
      const user = {
        id: 'user-1',
        email,
        role: 'EMPLOYEE',
        full_name: 'Test User',
        suspended: false,
      };

      incrementAttempt.mockResolvedValue(1);
      repo.findByEmail.mockResolvedValue(user);
      repo.verifyPassword.mockResolvedValue(true);
      repo.storeRefreshTokenRedis.mockResolvedValue(undefined);

      const result = await service.login(email, password, ip, userAgent);

      expect(incrementAttempt).toHaveBeenCalledWith(email, ip);
      expect(repo.findByEmail).toHaveBeenCalledWith(email);
      expect(repo.verifyPassword).toHaveBeenCalledWith(user, password);
      expect(clearFailedAttempts).toHaveBeenCalledWith(email, ip);
      expect(recordLoginAttempt).toHaveBeenCalledWith(email, ip, true);
      expect(generateAccessToken).toHaveBeenCalledWith(user);
      expect(generateRefreshToken).toHaveBeenCalledWith(user);
      expect(hashToken).toHaveBeenCalledWith('mocked-refresh-token');
      expect(repo.storeRefreshTokenRedis).toHaveBeenCalledWith(
        user.id,
        'mocked-hash:mocked-refresh-token',
        expect.any(Date)
      );
      expect(result).toEqual({
        accessToken: 'mocked-access-token',
        refreshToken: 'mocked-refresh-token',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
        },
      });
    });

    it('login() invalid credentials', async () => {
      incrementAttempt.mockResolvedValue(1);
      repo.findByEmail.mockResolvedValue(null);
      argon2.verify.mockResolvedValue(true);

      await expect(
        service.login(email, password, ip, userAgent)
      ).rejects.toThrow('Invalid credentials');
      expect(argon2.verify).toHaveBeenCalledWith(expect.any(String), password);
      expect(recordLoginAttempt).toHaveBeenCalledWith(email, ip, false);
      expect(repo.verifyPassword).not.toHaveBeenCalled();
    });

    it('login() suspended user', async () => {
      const suspendedUser = {
        id: 'user-1',
        email,
        role: 'EMPLOYEE',
        full_name: 'Test User',
        suspended: true,
      };

      incrementAttempt.mockResolvedValue(1);
      repo.findByEmail.mockResolvedValue(suspendedUser);
      argon2.verify.mockResolvedValue(true);

      await expect(
        service.login(email, password, ip, userAgent)
      ).rejects.toThrow('Invalid credentials');
      expect(argon2.verify).toHaveBeenCalledWith(expect.any(String), password);
      expect(recordLoginAttempt).toHaveBeenCalledWith(email, ip, false);
      expect(repo.verifyPassword).not.toHaveBeenCalled();
    });

    it('login() account locked', async () => {
      incrementAttempt.mockResolvedValue(6);

      await expect(
        service.login(email, password, ip, userAgent)
      ).rejects.toThrow('Account temporarily locked. Please try again later.');
      expect(repo.findByEmail).not.toHaveBeenCalled();
      expect(recordLoginAttempt).not.toHaveBeenCalled();
    });

    it('login() Redis/brute-force failure', async () => {
      incrementAttempt.mockRejectedValue(new Error('Redis failure'));

      await expect(
        service.login(email, password, ip, userAgent)
      ).rejects.toThrow(
        'Login temporarily unavailable. Please try again later.'
      );
      expect(repo.findByEmail).not.toHaveBeenCalled();
      expect(recordLoginAttempt).not.toHaveBeenCalled();
    });
  });

  describe('refreshTokens()', () => {
    it('refreshTokens() success', async () => {
      const user = {
        id: 'user-1',
        email,
        role: 'EMPLOYEE',
        full_name: 'Test User',
        suspended: false,
      };

      verifyRefreshToken.mockReturnValue({ id: user.id });
      repo.claimRefreshToken.mockResolvedValue(user.id);
      repo.findById.mockResolvedValue(user);
      repo.storeRefreshTokenRedis.mockResolvedValue(undefined);

      const result = await service.refreshTokens('valid-refresh', ip);

      expect(verifyRefreshToken).toHaveBeenCalledWith('valid-refresh');
      expect(hashToken).toHaveBeenCalledWith('valid-refresh');
      expect(repo.claimRefreshToken).toHaveBeenCalledWith(
        'mocked-hash:valid-refresh'
      );
      expect(repo.findById).toHaveBeenCalledWith(user.id);
      expect(repo.storeRefreshTokenRedis).toHaveBeenCalledWith(
        user.id,
        'mocked-hash:mocked-refresh-token',
        expect.any(Date)
      );
      expect(result).toEqual({
        accessToken: 'mocked-access-token',
        refreshToken: 'mocked-refresh-token',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
        },
      });
    });

    it('refreshTokens() invalid token', async () => {
      verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid payload');
      });

      await expect(service.refreshTokens('bad-token', ip)).rejects.toThrow(
        'Invalid refresh token'
      );
      expect(repo.claimRefreshToken).not.toHaveBeenCalled();
    });

    it('refreshTokens() revoked token', async () => {
      verifyRefreshToken.mockReturnValue({ id: 'user-1' });
      repo.claimRefreshToken.mockResolvedValue(null);

      await expect(
        service.refreshTokens('revoked-refresh', ip)
      ).rejects.toThrow('Token revoked/expired');
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('refreshTokens() suspended user', async () => {
      const suspendedUser = {
        id: 'user-1',
        suspended: true,
      };

      verifyRefreshToken.mockReturnValue({ id: suspendedUser.id });
      repo.claimRefreshToken.mockResolvedValue(suspendedUser.id);
      repo.findById.mockResolvedValue(suspendedUser);

      await expect(
        service.refreshTokens('suspended-refresh', ip)
      ).rejects.toThrow('User not found/suspended');
      expect(repo.storeRefreshTokenRedis).not.toHaveBeenCalled();
    });
  });

  describe('logout()', () => {
    it('logout() success', async () => {
      verifyRefreshToken.mockReturnValue({ id: 'user-1' });
      repo.revokeRefreshTokenRedis.mockResolvedValue(undefined);
      blacklistAccessToken.mockResolvedValue(undefined);

      const accessExp = Math.floor(Date.now() / 1000) + 60;

      await service.logout(
        'valid-refresh',
        'user-1',
        'access-jti',
        accessExp,
        ip,
        userAgent
      );

      expect(verifyRefreshToken).toHaveBeenCalledWith('valid-refresh');
      expect(repo.revokeRefreshTokenRedis).toHaveBeenCalledWith(
        'mocked-hash:valid-refresh'
      );
      expect(blacklistAccessToken).toHaveBeenCalledWith(
        'access-jti',
        expect.any(Number)
      );
      expect(createAuditLog).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'LOGOUT',
        resourceType: 'auth',
        resourceId: 'user-1',
        ipAddress: ip,
        userAgent,
      });
    });

    it('logout() invalid refresh token', async () => {
      verifyRefreshToken.mockImplementation(() => {
        throw new Error('Bad token');
      });

      await expect(
        service.logout(
          'invalid-refresh',
          'user-1',
          'access-jti',
          12345,
          ip,
          userAgent
        )
      ).rejects.toThrow('Invalid refresh token');
      expect(repo.revokeRefreshTokenRedis).not.toHaveBeenCalled();
      expect(blacklistAccessToken).not.toHaveBeenCalled();
    });

    it('logout() token/user mismatch', async () => {
      verifyRefreshToken.mockReturnValue({ id: 'other-user' });

      await expect(
        service.logout(
          'valid-refresh',
          'user-1',
          'access-jti',
          12345,
          ip,
          userAgent
        )
      ).rejects.toThrow('Token does not belong to authenticated user');
      expect(repo.revokeRefreshTokenRedis).not.toHaveBeenCalled();
      expect(blacklistAccessToken).not.toHaveBeenCalled();
    });
  });
});
