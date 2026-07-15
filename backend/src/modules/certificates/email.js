const nodemailer = require('nodemailer');
const path = require('path');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || 'apikey',
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendCertificateEmail({ to, subject, text, html, attachments }) {
  const mailer = getTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@internops.com',
    to,
    subject,
    text,
    html,
    attachments: attachments || [],
  };

  const result = await mailer.sendMail(mailOptions);
  return result;
}

async function sendBulkCertificates({ certificates, subject, body, pdfDir }) {
  const results = { sent: 0, failed: 0, errors: [] };

  for (const cert of certificates) {
    if (!cert.recipient_email) {
      results.failed++;
      results.errors.push({
        name: cert.recipient_name,
        error: 'No email address',
      });
      continue;
    }

    try {
      const pdfPath = cert.pdf_path ? path.join(pdfDir, cert.pdf_path) : null;
      const attachments = pdfPath
        ? [
            {
              filename: `${cert.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
              path: pdfPath,
            },
          ]
        : [];

      await sendCertificateEmail({
        to: cert.recipient_email,
        subject: subject || 'Your Certificate',
        text:
          body ||
          `Dear ${cert.recipient_name},\n\nPlease find your certificate attached.\n\nBest regards,\nInternOps Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Certificate of ${cert.certificate_type || 'Achievement'}</h2>
            <p>Dear <strong>${cert.recipient_name}</strong>,</p>
            <p>${body || 'Please find your certificate attached.'}</p>
            <p>Certificate: <strong>${cert.title}</strong></p>
            <br/>
            <p>Best regards,<br/>InternOps Team</p>
          </div>
        `,
        attachments,
      });

      results.sent++;
    } catch (err) {
      results.failed++;
      results.errors.push({
        name: cert.recipient_name,
        email: cert.recipient_email,
        error: err.message,
      });
    }
  }

  return results;
}

module.exports = { sendCertificateEmail, sendBulkCertificates };
