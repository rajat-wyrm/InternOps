const nodemailer = require('nodemailer');
const config = require('../config');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { getRedisClient } = require('../config/redis');
const pool = require('../config/db');

const log = pino(
  process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : {}
);

// In-memory fallbacks — used only when Redis / DB are unavailable
const _fallbackRateLimitMap = new Map();
const _fallbackBounceList = new Map();

// Periodic cleanup of the in-memory fallback structures (#990, #948, #994, #944)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const BOUNCE_TTL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [email, timestamps] of _fallbackRateLimitMap) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) _fallbackRateLimitMap.delete(email);
    else _fallbackRateLimitMap.set(email, fresh);
  }

  for (const [email, timestamp] of _fallbackBounceList) {
    if (now - timestamp >= BOUNCE_TTL_MS) {
      _fallbackBounceList.delete(email);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

const metrics = { sent: 0, failed: 0, bounced: 0, retried: 0 };

// --- Email delivery queue (in-memory) ---
const emailQueue = [];
let queueProcessing = false;
const queueMetrics = { queued: 0, processed: 0 };

function enqueueEmailJob(jobFn) {
  return new Promise((resolve, reject) => {
    emailQueue.push({ jobFn, resolve, reject });
    queueMetrics.queued++;
    processQueue();
  });
}

async function processQueue() {
  if (queueProcessing) return; // already running, new job will be picked up in the loop
  queueProcessing = true;
  while (emailQueue.length > 0) {
    const { jobFn, resolve, reject } = emailQueue.shift();
    try {
      const result = await jobFn();
      queueMetrics.processed++;
      resolve(result);
    } catch (err) {
      queueMetrics.processed++;
      reject(err);
    }
  }
  queueProcessing = false;
}

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this._loadTemplates();
  }

  _loadTemplates() {
    const dir = path.join(__dirname, 'templates');
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.html') || file.endsWith('.txt')) {
        const name = file.replace(/\.(html|txt)$/, '');
        const ext = file.endsWith('.html') ? 'html' : 'txt';
        if (!this.templates[name]) this.templates[name] = {};
        this.templates[name][ext] = fs.readFileSync(
          path.join(dir, file),
          'utf-8'
        );
      }
    }
  }

  getTransporter() {
    if (this.transporter) return this.transporter;
    const hasValidCreds =
      config.email.user &&
      config.email.pass &&
      config.email.pass !== 'your-smtp-password' &&
      !config.email.pass.startsWith('your-');
    if (!config.email.host || !hasValidCreds) {
      log.warn('SMTP not configured – using console fallback');
      return null;
    }
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: { user: config.email.user, pass: config.email.pass },
    });
    return this.transporter;
  }

  async _checkRateLimit(to) {
    const windowMs = config.email.rateLimitWindowMs || 60000;
    const max = config.email.rateLimitPerRecipient || 5;
    const windowSec = Math.ceil(windowMs / 1000);
    const key = `email_rl:${to}`;

    try {
      const redis = await getRedisClient();
      if (redis) {
        // Redis-backed: atomic increment + sliding window via TTL
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
        if (count > max) {
          throw new Error(`Rate limit exceeded for ${to}`);
        }
        return;
      }
    } catch (err) {
      if (err.message.startsWith('Rate limit exceeded')) throw err;
      log.warn(
        { err: err.message },
        'Redis rate-limit check failed; falling back to in-memory'
      );
    }

    // In-memory fallback (single-instance only)
    const now = Date.now();
    if (!_fallbackRateLimitMap.has(to)) _fallbackRateLimitMap.set(to, []);
    const timestamps = _fallbackRateLimitMap
      .get(to)
      .filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      throw new Error(`Rate limit exceeded for ${to}`);
    }
    timestamps.push(now);
    _fallbackRateLimitMap.set(to, timestamps);
  }

  async _checkBounce(to) {
    if (!config.email.bounceCheckEnabled) return;

    if (process.env.NODE_ENV !== 'test') {
      try {
        const { rows } = await pool.query(
          `SELECT bounced_at FROM bounced_emails WHERE email = $1`,
          [to]
        );
        if (rows.length > 0) {
          const age = Date.now() - new Date(rows[0].bounced_at).getTime();
          if (age < BOUNCE_TTL_MS) {
            throw new Error(`Bounced address suppressed: ${to}`);
          }
        }
        return;
      } catch (err) {
        if (err.message.startsWith('Bounced address suppressed')) throw err;
        log.warn(
          { err: err.message },
          'DB bounce check failed; falling back to in-memory'
        );
      }
    }

    // In-memory fallback (always used in test, fallback in production when DB is unavailable)
    const bouncedAt = _fallbackBounceList.get(to);
    if (bouncedAt && Date.now() - bouncedAt < BOUNCE_TTL_MS) {
      throw new Error(`Bounced address suppressed: ${to}`);
    }
  }

  _render(templateName, data) {
    const tpl = this.templates[templateName];
    if (!tpl) return { html: null, text: null };
    const render = (str) => {
      if (!str) return null;
      return str
        .replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] != null ? data[k] : ''))
        .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, content) =>
          data[k]
            ? content.replace(/\{\{(\w+)\}\}/g, (__, kk) =>
                data[kk] != null ? data[kk] : ''
              )
            : ''
        );
    };
    return {
      html: render(tpl.html),
      text: render(tpl.txt),
    };
  }

  _stripHtml(html) {
    return html
      ? html
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : '';
  }

  async send({ to, subject, template, data, html, text }) {
    if (!to || !subject)
      throw new Error('Missing required fields: to, subject');
    await this._checkBounce(to);
    await this._checkRateLimit(to);
    enqueueEmailJob(() =>
      this._deliver({ to, subject, template, data, html, text })
    ).catch((err) => {
      log.error(
        { to, subject, err: err.message },
        'Queued email ultimately failed after retries'
      );
    });
    return {
      queued: true,
      to,
      subject,
    };
  }

  async _deliver({ to, subject, template, data, html, text }) {
    let htmlContent = html;
    let textContent = text;

    if (template) {
      const rendered = this._render(template, { ...data, to, subject });
      htmlContent = htmlContent || rendered.html;
      textContent = textContent || rendered.text;
    }

    if (!htmlContent && !textContent) {
      textContent = ' ';
    }

    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      text: textContent || (htmlContent ? this._stripHtml(htmlContent) : ''),
      html: htmlContent || undefined,
    };

    const transporter = this.getTransporter();
    if (!transporter) {
      log.info(
        { to, subject },
        'Email placeholder (no SMTP transporter configured)'
      );
      metrics.sent++;
      return {
        messageId: 'console-' + Date.now(),
        accepted: [to],
        rejected: [],
      };
    }

    const maxRetries = config.email.retryMax || 3;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          metrics.retried++;
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((r) => setTimeout(r, delay));
        }
        const info = await transporter.sendMail(mailOptions);
        metrics.sent++;
        if (info.rejected && info.rejected.length > 0) {
          await this._recordBounces(info.rejected);
          metrics.bounced += info.rejected.length;
        }
        return info;
      } catch (err) {
        lastError = err;
        log.error(
          {
            to,
            attempt: attempt + 1,
            maxAttempts: maxRetries + 1,
            err: err.message,
          },
          'Email send attempt failed'
        );
        if (err.responseCode >= 500 || /55[0135]/.test(err.message)) {
          await this._recordBounces([to], err.message);
          metrics.bounced++;
          break;
        }
      }
    }

    metrics.failed++;
    log.error(
      { to, err: lastError?.message },
      'All email send attempts failed'
    );
    throw lastError || new Error(`Failed to send email to ${to}`);
  }

  async sendPasswordReset(email, resetToken) {
    const resetLink = `${config.appUrl || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(resetToken)}`;
    return this.send({
      to: email,
      subject: 'InternOps - Password Reset Request',
      template: 'password-reset',
      data: { resetLink, email },
    });
  }

  async sendAccountVerification(email, verificationToken) {
    const verifyLink = `${config.appUrl || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    return this.send({
      to: email,
      subject: 'InternOps - Verify Your Email',
      template: 'account-verification',
      data: { verifyLink, email },
    });
  }

  async sendNotification(email, { title, message, actionUrl, actionText }) {
    return this.send({
      to: email,
      subject: `InternOps - ${title}`,
      template: 'notification',
      data: { title, message, actionUrl, actionText },
    });
  }

  async _flushQueue() {
    // waits until the queue has fully drained (test helper)
    while (queueProcessing || emailQueue.length > 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  getMetrics() {
    return { ...metrics, ...queueMetrics, queueLength: emailQueue.length };
  }

  resetMetrics() {
    metrics.sent = 0;
    metrics.failed = 0;
    metrics.bounced = 0;
    metrics.retried = 0;
  }

  _clearRateLimits() {
    _fallbackRateLimitMap.clear();
  }

  async _recordBounces(addresses, reason) {
    if (process.env.NODE_ENV === 'test') {
      for (const addr of addresses) {
        _fallbackBounceList.set(addr, Date.now());
      }
      return;
    }

    try {
      for (const addr of addresses) {
        await pool.query(
          `INSERT INTO bounced_emails (email, bounced_at, reason)
           VALUES ($1, NOW(), $2)
           ON CONFLICT (email) DO UPDATE
             SET bounced_at = NOW(), reason = EXCLUDED.reason`,
          [addr, reason || null]
        );
      }
    } catch (err) {
      log.warn(
        { err: err.message },
        'Failed to persist bounce to DB; using in-memory fallback'
      );
      for (const addr of addresses) {
        _fallbackBounceList.set(addr, Date.now());
      }
    }
  }

  _trackBounce(address) {
    // Kept for backward-compat with tests; delegates to the persistent path
    return this._recordBounces([address]);
  }

  async _clearBounceList() {
    _fallbackBounceList.clear();
    if (process.env.NODE_ENV === 'test') return;
    try {
      await pool.query('DELETE FROM bounced_emails');
    } catch (err) {
      log.warn({ err: err.message }, 'Failed to clear bounced_emails table');
    }
  }
}

module.exports = new EmailService();
