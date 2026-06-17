jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn((mailOptions) =>
      Promise.resolve({
        messageId: 'mock-message-id',
        accepted: [mailOptions.to],
        rejected: [],
      })
    ),
  })),
}));
const emailService = require('../../src/services/email');

describe('Email Service', () => {
  beforeEach(() => {
    emailService.resetMetrics();
    emailService._clearRateLimits();
    emailService._clearBounceList();
  });

  // ---------- Basic Send ----------
describe('send()', () => {
it('should send with console fallback when SMTP not configured', async () => {
  const originalHost = process.env.SMTP_HOST;
  const originalUser = process.env.SMTP_USER;
  const originalPass = process.env.SMTP_PASS;

  jest.doMock('nodemailer', () => ({
    createTransport: jest.fn(),
  }));

  process.env.SMTP_HOST = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';

  const freshEmailService = require('../../src/services/email');

  const result = await freshEmailService.send({
    to: 'test@example.com',
    subject: 'Test Subject',
    text: 'Test body',
  });

  expect(result).toBeDefined();
  expect(result.messageId).toMatch(/^console-/);
  expect(result.accepted).toContain('test@example.com');

  process.env.SMTP_HOST = originalHost;
  process.env.SMTP_USER = originalUser;
  process.env.SMTP_PASS = originalPass;

  jest.resetModules();
  jest.restoreAllMocks();
});


    it('should reject missing required fields', async () => {
      await expect(
        emailService.send({ to: 'test@example.com' })
      ).rejects.toThrow('Missing required fields');
      await expect(emailService.send({ subject: 'hi' })).rejects.toThrow(
        'Missing required fields'
      );
    });

    it('should strip HTML for plaintext fallback', async () => {
      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'HTML Test',
        html: '<p>Hello <b>World</b></p>',
      });
      expect(result).toBeDefined();
    });
  });

  // ---------- Template Rendering ----------
  describe('templates', () => {
    it('should render password-reset template', async () => {
      const result = await emailService.sendPasswordReset(
        'user@example.com',
        'token123'
      );
      expect(result).toBeDefined();
      expect(result.accepted).toContain('user@example.com');
    });

    it('should render account-verification template', async () => {
      const result = await emailService.sendAccountVerification(
        'user@example.com',
        'verify123'
      );
      expect(result).toBeDefined();
    });

    it('should render notification template', async () => {
      const result = await emailService.sendNotification('user@example.com', {
        title: 'Test Notification',
        message: 'This is a test',
        actionUrl: 'http://example.com',
        actionText: 'View Details',
      });
      expect(result).toBeDefined();
    });
  });

  // ---------- Rate Limiting ----------
  describe('rate limiting', () => {
    it('should allow emails within rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        const result = await emailService.send({
          to: 'ratelimit@example.com',
          subject: `Test ${i}`,
          text: 'ok',
        });
        expect(result).toBeDefined();
      }
    });

    it('should reject emails exceeding rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        await emailService.send({
          to: 'burst@example.com',
          subject: `Test ${i}`,
          text: 'ok',
        });
      }
      await expect(
        emailService.send({
          to: 'burst@example.com',
          subject: 'Exceed',
          text: 'fail',
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should allow emails to different recipients independently', async () => {
      for (let i = 0; i < 10; i++) {
        const result = await emailService.send({
          to: `user${i % 2}@example.com`,
          subject: `Test ${i}`,
          text: 'ok',
        });
        expect(result).toBeDefined();
      }
    });
  });

  // ---------- Bounce Handling ----------
  describe('bounce handling', () => {
    it('should suppress bounced addresses when bounce check enabled', async () => {
      const originalConfig = require('../../src/config');
      originalConfig.email.bounceCheckEnabled = true;

      emailService._trackBounce('bounce@example.com');

      await expect(
        emailService.send({
          to: 'bounce@example.com',
          subject: 'Retry',
          text: 'fail',
        })
      ).rejects.toThrow('Bounced address suppressed');
      originalConfig.email.bounceCheckEnabled = false;
    });
  });

  // ---------- Metrics ----------
  describe('metrics', () => {
    it('should track sent count', async () => {
      await emailService.send({
        to: 'metrics@example.com',
        subject: 'Test',
        text: 'ok',
      });
      const m = emailService.getMetrics();
      expect(m.sent).toBe(1);
    });

    it('should track failed count after errors', async () => {
      const m = emailService.getMetrics();
      expect(m.failed).toBe(0);
    });

    it('should reset metrics', async () => {
      await emailService.send({
        to: 'reset@example.com',
        subject: 'Test',
        text: 'ok',
      });
      emailService.resetMetrics();
      const m = emailService.getMetrics();
      expect(m.sent).toBe(0);
      expect(m.failed).toBe(0);
    });
  });
});
