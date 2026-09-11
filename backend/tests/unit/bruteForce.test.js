const {
  isAccountLocked,
  recordLoginAttempt,
  clearFailedAttempts,
  bruteForceCheck,
  incrementAttempt,
  assertNotLocked,
  checkAndRecordAttempt,
  setMaxAttempts,
  getMaxAttempts,
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
    setMaxAttempts(5);
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
    };
    getRedisClient.mockResolvedValue(mockRedis);
  });

  afterEach(() => {
    setMaxAttempts(5);
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

  describe('Threshold Consistency across preHandler and checkAndRecordAttempt', () => {
    it('should trip BOTH preHandler path and in-handler path at the exact same custom threshold', async () => {
      setMaxAttempts(3);

      // Attempt 1: preHandler sees prior count 0 (not locked), checkAndRecordAttempt increments to 1 (not locked)
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);
      await expect(assertNotLocked(email, ip)).resolves.not.toThrow();
      await expect(checkAndRecordAttempt(email, ip)).resolves.toBe(1);

      // Attempt 2: preHandler sees prior count 1 (not locked), checkAndRecordAttempt increments to 2 (not locked)
      mockRedis.get.mockResolvedValue('1');
      mockRedis.incr.mockResolvedValue(2);
      await expect(assertNotLocked(email, ip)).resolves.not.toThrow();
      await expect(checkAndRecordAttempt(email, ip)).resolves.toBe(2);

      // Attempt 3: preHandler sees prior count 2 (not locked)
      mockRedis.get.mockResolvedValue('2');
      await expect(assertNotLocked(email, ip)).resolves.not.toThrow();

      // Attempt 3 in-handler: checkAndRecordAttempt increments to 3 -> TRIPS at 3!
      mockRedis.get.mockResolvedValue(null); // lockout email key not set yet
      mockRedis.incr.mockResolvedValue(3);
      await expect(checkAndRecordAttempt(email, ip)).rejects.toThrow(
        UnauthorizedError
      );

      // Attempt 4: preHandler sees prior count 3 -> TRIPS at 3!
      mockRedis.get.mockImplementation((key) => {
        if (key === `brute:${email}:${ip}`) return '3';
        if (key === `lockout-email:${email}`) return '1';
      });
      await expect(assertNotLocked(email, ip)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });

  describe('Notification deduplication across request cycle', () => {
    it('should send lockout notification exactly once even when both preHandler and login() run in same cycle', async () => {
      let emailSentCount = 0;
      let lockoutKeySet = false;

      mockRedis.get.mockImplementation((key) => {
        if (key === `brute:${email}:${ip}`) return '4'; // Prior state before 5th attempt
        if (key === `lockout-email:${email}`) return lockoutKeySet ? '1' : null;
      });

      mockRedis.incr.mockImplementation(async (key) => {
        if (key === `brute:${email}:${ip}`) return 5; // 5th attempt
      });

      mockRedis.set.mockImplementation(async (key) => {
        if (key === `lockout-email:${email}`) lockoutKeySet = true;
      });

      // 1. preHandler runs prior to 5th attempt (count is 4 < 5) -> allowed
      await expect(assertNotLocked(email, ip)).resolves.not.toThrow();
      expect(emailService.sendAccountLockoutNotification).toHaveBeenCalledTimes(
        0
      );

      // 2. login() runs checkAndRecordAttempt -> increments count to 5 -> locks and sends email
      await expect(checkAndRecordAttempt(email, ip)).rejects.toThrow(
        UnauthorizedError
      );
      expect(emailService.sendAccountLockoutNotification).toHaveBeenCalledTimes(
        1
      );

      // 3. Subsequent request: preHandler runs when state is 5 -> rejects, but email key is set so no duplicate email
      mockRedis.get.mockImplementation((key) => {
        if (key === `brute:${email}:${ip}`) return '5';
        if (key === `lockout-email:${email}`) return lockoutKeySet ? '1' : null;
      });

      await expect(assertNotLocked(email, ip)).rejects.toThrow(
        UnauthorizedError
      );
      expect(emailService.sendAccountLockoutNotification).toHaveBeenCalledTimes(
        1
      );
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
