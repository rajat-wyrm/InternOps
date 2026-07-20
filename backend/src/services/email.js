const nodemailer = require('nodemailer');
const config = require('../config');
const pool = require('../config/db');
const { getRedisClient } = require('../config/redis');
const path = require('path');
const fs = require('fs');

const rateLimitMap = new Map();
const bounceList = new Set();

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
      console.warn('[Email] SMTP not configured – using console fallback');
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
    const redis = await getRedisClient();

    if (redis) {
      const count = await redis.incr(`email_rl:${to}`);
      if (count === 1) {
        await redis.expire(`email_rl:${to}`, Math.ceil(windowMs / 1000));
      }
      if (count > max) {
        throw new Error(`Rate limit exceeded for ${to}`);
      }
      return;
    }

    const now = Date.now();
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
    await this._checkRateLimit(to);

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
      console.log(`[Email] Placeholder -> To: ${to}, Subject: "${subject}"`);
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
        console.error(
          `[Email] Attempt ${attempt + 1}/${maxRetries + 1} failed for ${to}: ${err.message}`
        );
        if (err.responseCode >= 500 || /55[0135]/.test(err.message)) {
          bounceList.add(to);
          metrics.bounced++;
          break;
        }
      }
    }

    metrics.failed++;
    console.error(
      `[Email] All attempts failed for ${to}: ${lastError?.message}`
    );
    throw lastError || new Error(`Failed to send email to ${to}`);
  }

  async sendPasswordReset(email, resetToken) {
    const resetLink = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password#token=${encodeURIComponent(resetToken)}`;
    return this.send({
      to: email,
      subject: 'InternOps - Password Reset Request',
      template: 'password-reset',
      data: { resetLink, email },
    });
  }

  async sendAccountVerification(email, verificationToken) {
    const verifyLink = `${process.env.APP_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
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

  async _recordBounces(addresses) {
    try {
      await pool.query('INSERT INTO bounced_emails (email) VALUES ($1)', [
        addresses,
      ]);
    } catch {
      // fallback to in-memory bounce list when DB is unavailable
    }
    addresses.forEach((address) => bounceList.add(address));
  }

  _clearBounceList() {
    bounceList.clear();
  }

  async _flushQueue() {
    return undefined;
  }

  async _deliver(mailOptions) {
    return this.send(mailOptions);
  }

  async sendAccountLockoutNotification(
    email,
    { ipAddress, timestamp, failedAttempts }
  ) {
    return this.send({
      to: email,
      subject: 'InternOps - Account Lockout Alert',
      html: `
            <p>Your account has been locked due to <strong>${failedAttempts}</strong> failed login attempts.</p>
            <p><strong>IP Address:</strong> ${ipAddress}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
            <p>If this was not you, please secure your account immediately.</p>
        `,
      text: `Your account has been locked due to ${failedAttempts} failed login attempts.\nIP: ${ipAddress}\nTimestamp: ${timestamp}`,
    });
  }
}

module.exports = new EmailService();
