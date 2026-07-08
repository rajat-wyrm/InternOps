const nodemailer = require('nodemailer');
const config = require('../config');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const log = pino(
  process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : {}
);

const rateLimitMap = new Map();
const bounceList = new Set();

// Periodic cleanup to prevent memory leaks (#990, #948, #994, #944)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [email, timestamps] of rateLimitMap) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) rateLimitMap.delete(email);
    else rateLimitMap.set(email, fresh);
  }
}, CLEANUP_INTERVAL_MS).unref();

const metrics = { sent: 0, failed: 0, bounced: 0, retried: 0 };

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

  _checkRateLimit(to) {
    const now = Date.now();
    const windowMs = config.email.rateLimitWindowMs || 60000;
    const max = config.email.rateLimitPerRecipient || 5;
    if (!rateLimitMap.has(to)) rateLimitMap.set(to, []);
    const timestamps = rateLimitMap.get(to).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      throw new Error(`Rate limit exceeded for ${to}`);
    }
    timestamps.push(now);
    rateLimitMap.set(to, timestamps);
  }

  _checkBounce(to) {
    if (config.email.bounceCheckEnabled && bounceList.has(to)) {
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
    this._checkBounce(to);
    this._checkRateLimit(to);

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
      log.info({ to, subject }, 'Email placeholder (no SMTP transporter configured)');
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
          info.rejected.forEach((addr) => bounceList.add(addr));
          metrics.bounced += info.rejected.length;
        }
        return info;
      } catch (err) {
        lastError = err;
        log.error(
          { to, attempt: attempt + 1, maxAttempts: maxRetries + 1, err: err.message },
          'Email send attempt failed'
        );
        if (err.responseCode >= 500 || /55[0135]/.test(err.message)) {
          bounceList.add(to);
          metrics.bounced++;
          break;
        }
      }
    }

    metrics.failed++;
    log.error({ to, err: lastError?.message }, 'All email send attempts failed');
    throw lastError || new Error(`Failed to send email to ${to}`);
  }

  async sendPasswordReset(email, resetToken) {
    const resetLink = `${config.appUrl || 'http://localhost:5173'}/reset-password#token=${encodeURIComponent(resetToken)}`;
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

  getMetrics() {
    return { ...metrics };
  }

  resetMetrics() {
    metrics.sent = 0;
    metrics.failed = 0;
    metrics.bounced = 0;
    metrics.retried = 0;
  }

  _clearRateLimits() {
    rateLimitMap.clear();
  }

  _trackBounce(address) {
    bounceList.add(address);
  }

  _clearBounceList() {
    bounceList.clear();
  }
}

module.exports = new EmailService();
