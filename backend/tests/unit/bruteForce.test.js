const {
  isAccountLocked,
  recordLoginAttempt,
  clearFailedAttempts,
  bruteForceCheck,
  incrementAttempt,
  assertNotLocked,
} = require('../../src/middleware/bruteForce');
const pool = require('../../src/config/db');
const { getRedisClient } = require('../../src/config/redis');
const emailService = require('../../src/services/email');
const { notifyAdmin } = require('../../src/modules/notifications/repository');
const { UnauthorizedError } = require('../../src/utils/errors');

jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('../../src/services/email', () => ({
  sendAccountLockoutNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/modules/notifications/repository', () => ({
  notifyAdmin: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/modules/auth/repository', () => ({
  findByEmail: jest
    .fn()
    .mockResolvedValue({ id: 'user-1', email: 'test@example.com' }),
}));

describe('Brute Force Protection', () => {
  const email = 'test@example.com';
  const ip = '127.0.0.1';
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
    };
    getRedisClient.mockResolvedValue(mockRedis);
  });

  describe('isAccountLocked and DB query optimization', () => {
    it('should query DB if Redis returns null', async () => {
      mockRedis.get.mockResolvedValue(null);
      pool.query.mockResolvedValue({ rows: [{ failed: '0' }] });

      const result = await isAccountLocked(email, ip);

      expect(result).toBe(false);
      expect(pool.query).toHaveBeenCalledTimes(2); // One for email, one for IP
    });

    it('should NOT query DB if Redis has a counter value < MAX_ATTEMPTS', async () => {
      mockRedis.get.mockResolvedValue('3');

      const result = await isAccountLocked(email, ip);

      expect(result).toBe(false);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should return true if Redis counter >= MAX_ATTEMPTS', async () => {
      mockRedis.get.mockResolvedValue('5');

      const result = await isAccountLocked(email, ip);

      expect(result).toBe(true);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('Off-by-one behavior and Thresholds', () => {
    it('should allow 1 to 4 attempts but lock exactly at 5', async () => {
      // attempts 1 to 4
      for (let i = 1; i <= 4; i++) {
        mockRedis.get.mockResolvedValue(String(i - 1)); // State before incrementing
        await expect(assertNotLocked(email, ip)).resolves.not.toThrow();
      }

      // attempt 5 (state is 4)
      mockRedis.get.mockResolvedValue('4');
      await expect(assertNotLocked(email, ip)).resolves.not.toThrow();

      // attempt 6 (state is 5) - this is the 6th attempt (where count is 5)
      mockRedis.get.mockImplementation((key) => {
        if (key === `brute:${email}:${ip}`) return '5';
        if (key === `lockout-email:${email}`) return null;
      });

      await expect(assertNotLocked(email, ip)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(assertNotLocked(email, ip)).rejects.toThrow(
        'Account temporarily locked due to too many failed attempts. Please try again later.'
      );
    });
  });

  describe('Notification deduplication', () => {
    it('should send lockout notification exactly once', async () => {
      // Simulate account being locked
      mockRedis.get.mockImplementation((key) => {
        if (key === `brute:${email}:${ip}`) return '5';
        if (key === `lockout-email:${email}`) return null; // First time, not sent yet
      });

      await expect(assertNotLocked(email, ip)).rejects.toThrow(
        UnauthorizedError
      );

      expect(emailService.sendAccountLockoutNotification).toHaveBeenCalledTimes(
        1
      );
      expect(notifyAdmin).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `lockout-email:${email}`,
        '1',
        expect.any(Object)
      );

      // Simulate subsequent locked requests
      jest.clearAllMocks();
      mockRedis.get.mockImplementation((key) => {
        if (key === `brute:${email}:${ip}`) return '5';
        if (key === `lockout-email:${email}`) return '1'; // Already sent
      });

      await expect(assertNotLocked(email, ip)).rejects.toThrow(
        UnauthorizedError
      );

      expect(
        emailService.sendAccountLockoutNotification
      ).not.toHaveBeenCalled();
      expect(notifyAdmin).not.toHaveBeenCalled();
    });
  });

  describe('Redis behavior and Double-increment prevention', () => {
    it('incrementAttempt should increment Redis correctly', async () => {
      mockRedis.incr.mockResolvedValue(1);
      const count = await incrementAttempt(email, ip);

      expect(count).toBe(1);
      expect(mockRedis.incr).toHaveBeenCalledWith(`brute:${email}:${ip}`);
      expect(mockRedis.expire).toHaveBeenCalledWith(
        `brute:${email}:${ip}`,
        15 * 60
      );
    });

    it('recordLoginAttempt should NOT increment Redis (prevents double increment)', async () => {
      pool.query.mockResolvedValue({});

      await recordLoginAttempt(email, ip, false);

      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO login_attempts (email, ip_address, success) VALUES ($1,$2,$3)',
        [email, ip, false]
      );
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });
  });
});
