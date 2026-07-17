jest.mock('pino', () =>
  jest.fn(() => ({
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }))
);

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('../../src/config', () => ({
  email: {
    host: null,
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: 'no-reply@example.com',
    rateLimitWindowMs: 1000,
    rateLimitPerRecipient: 2,
    retryMax: 0,
    bounceCheckEnabled: true,
  },
  appUrl: 'http://localhost:3000',
}));

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

const nodemailer = require('nodemailer');
const config = require('../../src/config');
const { getRedisClient } = require('../../src/config/redis');
const pool = require('../../src/config/db');
const emailService = require('../../src/services/email');

describe('Email Service', () => {
  const to = 'user@example.com';
  const subject = 'Test Email';
  const text = 'Hello world';

  beforeEach(async () => {
    jest.clearAllMocks();
    config.email.rateLimitPerRecipient = 2;
    config.email.retryMax = 0;
    config.email.bounceCheckEnabled = true;
    emailService.resetMetrics();
    emailService._clearRateLimits();
    await emailService._clearBounceList();
    emailService.transporter = null;
    await emailService._flushQueue();
  });

  it('should send a placeholder email successfully when SMTP is not configured', async () => {
    getRedisClient.mockResolvedValue(null);

    const result = await emailService.send({ to, subject, text });

    expect(result).toEqual(
      expect.objectContaining({
        accepted: [to],
        rejected: [],
      })
    );
    expect(result.messageId).toMatch(/^console-/);
    await emailService._flushQueue();
    expect(emailService.getMetrics().sent).toBe(1);
  });

  it('should deliver email successfully with an SMTP transporter', async () => {
    const transporter = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: 'smtp-123',
        accepted: [to],
        rejected: [],
      }),
    };
    emailService.transporter = transporter;

    const result = await emailService._deliver({ to, subject, text });

    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: config.email.from,
      to,
      subject,
      text,
      html: undefined,
    });
    expect(result).toEqual({
      messageId: 'smtp-123',
      accepted: [to],
      rejected: [],
    });
    expect(emailService.getMetrics().sent).toBe(1);
  });

  it('should fail when the email provider rejects the message', async () => {
    const transporter = {
      sendMail: jest.fn().mockRejectedValue(
        Object.assign(new Error('550 mailbox unavailable'), {
          responseCode: 550,
        })
      ),
    };
    emailService.transporter = transporter;

    await expect(emailService._deliver({ to, subject, text })).rejects.toThrow(
      '550 mailbox unavailable'
    );

    expect(emailService.getMetrics().failed).toBe(1);
    expect(emailService.getMetrics().bounced).toBe(1);
  });

  it('should enforce fallback rate limiting for repeated recipients', async () => {
    getRedisClient.mockResolvedValue(null);
    config.email.rateLimitPerRecipient = 1;

    await emailService._checkRateLimit(to);

    await expect(emailService._checkRateLimit(to)).rejects.toThrow(
      `Rate limit exceeded for ${to}`
    );
  });

  it('should enforce redis-backed rate limiting when Redis is available', async () => {
    const redis = {
      incr: jest.fn().mockResolvedValue(2),
      expire: jest.fn().mockResolvedValue(true),
    };
    getRedisClient.mockResolvedValue(redis);
    config.email.rateLimitPerRecipient = 1;

    await expect(emailService._checkRateLimit(to)).rejects.toThrow(
      `Rate limit exceeded for ${to}`
    );
    expect(redis.incr).toHaveBeenCalledWith(`email_rl:${to}`);
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('should prevent sending to addresses flagged as bounced', async () => {
    await emailService._recordBounces([to]);

    expect(() => emailService._checkBounce(to)).toThrow(
      `Bounced address suppressed: ${to}`
    );
  });

  it('should throw when required send fields are missing', async () => {
    await expect(emailService.send({ subject, text })).rejects.toThrow(
      'Missing required fields: to, subject'
    );
    await expect(emailService.send({ to, text })).rejects.toThrow(
      'Missing required fields: to, subject'
    );
  });

  it('should fall back to in-memory bounce list when DB lookup fails', async () => {
    pool.query.mockRejectedValue(new Error('DB unavailable'));
    config.email.bounceCheckEnabled = true;

    await emailService._recordBounces([to]);
    expect(() => emailService._checkBounce(to)).toThrow(
      `Bounced address suppressed: ${to}`
    );
  });
});
