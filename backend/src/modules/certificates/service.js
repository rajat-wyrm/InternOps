const crypto = require('crypto');
const repo = require('./repository');
const { generateCertificatePDF } = require('./pdf');
const { generateQRCodeDataURL } = require('./qr');
const { DEFAULT_TEMPLATES } = require('./templates');
const path = require('path');
const fs = require('fs');
const pLimit = require('p-limit');

const UPLOAD_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'uploads',
  'certificates'
);

function safeSandbox(value, maxLen = 200) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value).slice(0, maxLen) : '';
  }
  if (typeof value !== 'string') {
    return String(value).slice(0, maxLen);
  }

  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeCertificatePromptData(data = {}) {
  return {
    type: safeSandbox(data.type, 50) || 'achievement',
    name: safeSandbox(data.name, 100),
    company: safeSandbox(data.company, 100),
    achievement: safeSandbox(data.achievement, 300),
    tone: safeSandbox(data.tone || 'formal', 50) || 'formal',
    language: safeSandbox(data.language || 'English', 50) || 'English',
  };
}

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================================
// Template Service
// ============================================================

async function seedDefaultTemplates(userId) {
  const existing = await repo.getTemplates({ limit: 1 });
  if (existing.length > 0) return existing.length;

  for (const tpl of DEFAULT_TEMPLATES) {
    await repo.createTemplate(tpl, userId);
  }
  return DEFAULT_TEMPLATES.length;
}

async function listTemplates(filters) {
  return repo.getTemplates(filters);
}

async function getTemplate(id) {
  return repo.getTemplateById(id);
}

async function createTemplate(data, userId) {
  return repo.createTemplate(data, userId);
}

async function updateTemplate(id, data) {
  return repo.updateTemplate(id, data);
}

async function deleteTemplate(id) {
  return repo.deleteTemplate(id);
}

// ============================================================
// Certificate Service
// ============================================================

async function generateCertificate(data, userId) {
  const template = data.template_id
    ? await repo.getTemplateById(data.template_id)
    : null;
  const templateData = template ? template.template_data : {};

  // Generate PDF
  const pdfBuffer = await generateCertificatePDF(
    {
      recipientName: data.recipient_name,
      title: data.title,
      body:
        data.body ||
        `This is to certify that ${data.recipient_name} has successfully completed ${data.title}`,
      issuer: data.issuer || 'InternOps',
      issueDate: data.issue_date || new Date().toISOString().slice(0, 10),
      certificateType: data.certificate_type,
    },
    templateData
  );

  // Generate unique verification token
  const verificationToken = crypto.randomUUID();

  // Generate verification URL
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:5173'}/verify/certificate/${verificationToken}`;

  // Generate QR code
  const qrCodeUrl = await generateQRCodeDataURL(verifyUrl);

  // Save PDF to disk
  const filename = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBuffer);

  // Save to database
  const cert = await repo.createCertificate(
    {
      ...data,
      status: 'generated',
      pdf_path: filename,
      qr_code_url: qrCodeUrl,
      verification_token: verificationToken,
    },
    userId
  );

  return {
    success: true,
    data: {
      ...cert,
      pdf_url: `/uploads/certificates/${filename}`,
      verification_token: verificationToken,
      verification_url: verifyUrl,
    },
  };
}

async function listCertificates(filters) {
  const certs = await repo.listCertificates(filters);
  return {
    success: true,
    data: certs.map((c) => ({
      ...c,
      pdf_url: c.pdf_path ? `/uploads/certificates/${c.pdf_path}` : null,
    })),
  };
}

async function getCertificate(id) {
  const cert = await repo.getCertificateById(id);
  if (!cert) return null;
  return {
    ...cert,
    pdf_url: cert.pdf_path ? `/uploads/certificates/${cert.pdf_path}` : null,
  };
}
async function verifyCertificate(token) {
  const cert = await repo.getCertificateByVerificationToken(token);

  if (!cert) {
    return null;
  }

  if (cert.status !== 'generated') {
    return {
      valid: false,
      reason: 'Certificate has not been issued',
    };
  }

  if (cert.revoked_at) {
    return {
      valid: false,
      reason: 'Certificate has been revoked',
      certificate: {
        ...cert,
        pdf_url: cert.pdf_path
          ? `/uploads/certificates/${cert.pdf_path}`
          : null,
      },
    };
  }

  return {
    valid: true,
    certificate: {
      ...cert,
      pdf_url: cert.pdf_path ? `/uploads/certificates/${cert.pdf_path}` : null,
    },
  };
}

async function deleteCertificate(id) {
  const cert = await repo.getCertificateById(id);
  if (!cert) return null;

  // Delete PDF file if exists
  if (cert.pdf_path) {
    const filePath = path.join(UPLOAD_DIR, cert.pdf_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  return repo.deleteCertificate(id);
}

async function revokeCertificate(id, reason = null) {
  const cert = await repo.getCertificateById(id);
  if (!cert) return null;
  return repo.revokeCertificate(id, reason);
}

// ============================================================
// Bulk Generation Service
// ============================================================

async function startBulkGeneration(data, userId) {
  const MAX_BULK_CERTIFICATES = 500;

  if (data.certificates.length > MAX_BULK_CERTIFICATES) {
    const err = new Error(
      `Bulk generation limit exceeded: maximum ${MAX_BULK_CERTIFICATES} certificates per request (received ${data.certificates.length})`
    );
    err.statusCode = 400;
    throw err;
  }

  const job = await repo.createBulkJob(
    {
      template_id: data.template_id,
      total_count: data.certificates.length,
      send_email: data.send_email,
      email_subject: data.email_subject,
      email_body: data.email_body,
      status: 'pending',
      completed_count: 0,
      failed_count: 0,
    },
    userId
  );

  const itemsToCreate = data.certificates.map((certData) => ({
    bulk_job_id: job.id,
    recipient_name: certData.recipient_name,
    recipient_email: certData.recipient_email,
    row_data: certData,
    status: 'pending',
  }));

  await repo.createBulkJobItemsBatch(itemsToCreate);

  const bulkJobQueue = require('../../services/bulkJobQueue');
  bulkJobQueue.addJob(job.id, data, userId);

  return {
    success: true,
    data: {
      job_id: job.id,
      total: data.certificates.length,
      generated: 0,
      failed: 0,
      errors: [],
    },
  };
}

async function processBulkGeneration(jobId, initialData, userId, pLimiter) {
  const limit = pLimiter || pLimit(5);

  const job = await repo.getBulkJobById(jobId);
  if (!job) return;

  const dbItems = await repo.getBulkJobItems(jobId);
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawTemplateId = initialData?.template_id || job.template_id;
  const templateId = uuidRegex.test(String(rawTemplateId || ''))
    ? rawTemplateId
    : null;

  let itemsToProcess = dbItems.filter((i) => i.status === 'pending');

  if (itemsToProcess.length === 0 && initialData?.certificates?.length > 0) {
    const batch = initialData.certificates.map((certData) => ({
      bulk_job_id: jobId,
      recipient_name: certData.recipient_name,
      recipient_email: certData.recipient_email,
      row_data: certData,
      status: 'pending',
    }));
    itemsToProcess = await repo.createBulkJobItemsBatch(batch);
  }

  let generated = job.completed_count || 0;
  let failed = job.failed_count || 0;
  const errors = [];
  let lastProgressUpdate = Date.now();

  const updateProgress = async (force = false) => {
    const now = Date.now();
    if (force || now - lastProgressUpdate > 300) {
      lastProgressUpdate = now;
      await repo
        .updateBulkJob(jobId, {
          completed_count: generated,
          failed_count: failed,
        })
        .catch(() => {});
    }
  };

  const tasks = itemsToProcess.map((item) =>
    limit(async () => {
      // Prevent duplicate certificate generation on crash recovery if certificate_id is already assigned
      if (item.certificate_id) {
        await repo
          .updateBulkJobItem(item.id, { status: 'generated' })
          .catch(() => {});
        generated++;
        await updateProgress();
        return;
      }

      const certData =
        typeof item.row_data === 'string'
          ? JSON.parse(item.row_data)
          : item.row_data || {
              recipient_name: item.recipient_name,
              recipient_email: item.recipient_email,
            };

      try {
        let cert;
        let lastErr;

        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            cert = await generateCertificate(
              {
                template_id: templateId,
                recipient_name: item.recipient_name || certData.recipient_name,
                recipient_email:
                  item.recipient_email || certData.recipient_email,
                title: certData.title || 'Certificate of Achievement',
                body: certData.body,
                issuer: certData.issuer,
                certificate_type: certData.certificate_type || 'achievement',
                metadata: certData.metadata,
              },
              userId || job.created_by
            );
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            if (attempt < 4) {
              await new Promise((r) => setTimeout(r, 200 * attempt));
            }
          }
        }

        if (lastErr) throw lastErr;

        let updatedItem = false;
        for (let updateAttempt = 1; updateAttempt <= 3; updateAttempt++) {
          try {
            await repo.updateBulkJobItem(item.id, {
              certificate_id: cert.data.id,
              status: 'generated',
            });
            updatedItem = true;
            break;
          } catch (updateErr) {
            if (updateAttempt < 3) await new Promise((r) => setTimeout(r, 150));
          }
        }

        if (updatedItem) {
          generated++;
        } else {
          failed++;
        }
      } catch (err) {
        await repo
          .updateBulkJobItem(item.id, {
            status: 'failed',
            error_message: err.message,
          })
          .catch(() => {});
        failed++;
        errors.push({
          recipient: item.recipient_name || 'Recipient',
          error: err.message,
        });
      }

      await updateProgress();
    })
  );

  await Promise.all(tasks);
  await updateProgress(true);

  const finalStatus =
    itemsToProcess.length > 0 && failed === itemsToProcess.length
      ? 'failed'
      : 'completed';

  await repo.updateBulkJob(jobId, {
    status: finalStatus,
    completed_count: generated,
    failed_count: failed,
    error_log: errors.length > 0 ? errors : undefined,
    completed_at: new Date().toISOString(),
  });
}

async function getBulkJobStatus(id) {
  const job = await repo.getBulkJobById(id);
  if (!job) return null;
  const items = await repo.getBulkJobItems(id);
  return { ...job, items };
}

// ============================================================
// AI Content Generation (ported from SyncAura, uses Gemini)
// ============================================================

async function generateAIContent(data) {
  const aiProvider = require('../../services/aiProviderService');
  const sanitized = sanitizeCertificatePromptData(data);

  const prompt = [
    `Generate professional certificate text for a ${sanitized.type} certificate.`,
    `Recipient: ${sanitized.name}`,
    `Company/Organization: ${sanitized.company}`,
    `Achievement: ${sanitized.achievement}`,
    `Tone: ${sanitized.tone}`,
    `Language: ${sanitized.language}`,
    'Return a JSON object with:',
    '- "title": The certificate title (e.g., "Certificate of Excellence")',
    '- "body": The certificate body text (2-3 sentences describing the achievement)',
    '- "footer": A footer line (e.g., "Awarded on [date]" or a closing statement)',
  ].join(' ');

  try {
    const result = await aiProvider.generate(prompt);
    const parsed = JSON.parse(result);
    return { success: true, data: parsed };
  } catch {
    return {
      success: true,
      data: {
        title: `Certificate of ${sanitized.type.charAt(0).toUpperCase() + sanitized.type.slice(1)}`,
        body: `This certificate is proudly presented to ${sanitized.name} from ${sanitized.company} in recognition of ${sanitized.achievement}.`,
        footer: `Awarded on ${new Date().toISOString().slice(0, 10)}`,
      },
    };
  }
}

async function suggestTemplate(data) {
  const aiProvider = require('../../services/aiProviderService');
  const sanitized = sanitizeCertificatePromptData(data);

  const templates = await repo.getTemplates({ limit: 10 });
  const templateNames = templates
    .map((t) => safeSandbox(t.name, 80))
    .join(', ');

  const prompt = `Given an achievement: "${sanitized.achievement}" of type "${sanitized.type}", which of these certificate templates would be most appropriate?
Available templates: ${templateNames}

Return only valid JSON in this exact format:
{"templateName":"<template name>"}`;

  try {
    const result = await aiProvider.generate(prompt);
    const matched = templates.find((t) =>
      result.includes(safeSandbox(t.name, 80))
    );
    return matched || templates[0];
  } catch {
    return templates[0];
  }
}

// ============================================================
// Quick Generate — simple cert generation with auto cert number
// ============================================================

async function quickGenerate(data, userId) {
  const pool = require('../../config/db');

  // 1. Auto-generate certificate number: CERT/DOMAIN/YYYY/NNNN
  const domainCode = (data.domain || 'GEN')
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 4)
    .toUpperCase();
  const year = new Date().getFullYear();
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM certificates WHERE EXTRACT(YEAR FROM created_at) = $1`,
    [year]
  );
  const seq = String(parseInt(countResult.rows[0].cnt) + 1).padStart(4, '0');
  const certificateNumber = `CERT/${domainCode}/${year}/${seq}`;

  // 2. Get template styling
  const template = data.template_id
    ? await repo.getTemplateById(data.template_id)
    : null;
  const templateData = template ? template.template_data : {};

  // 3. Build body text
  const startFormatted = formatDate(data.start_date);
  const endFormatted = formatDate(data.end_date);
  const body = `This is to certify that ${data.recipient_name} has successfully completed a ${data.domain} internship from ${startFormatted} to ${endFormatted}. The individual demonstrated excellent performance, dedication, and strong professional skills throughout the duration of the program.`;

  // 3b. Split text pieces for the branded PDF layout
  const roleLine = data.role
    ? `has successfully completed their internship as ${data.role} in the domain of`
    : 'has successfully completed their internship in the domain of';
  const dateRangeText = `from ${startFormatted} to ${endFormatted}`;
  const pdfBody =
    'During this period, the candidate demonstrated exemplary professional standards, technical proficiency, and significant contribution to our organizational goals.';
  // 4. Generate verification token
  const verificationToken = crypto.randomUUID();

  // Verification URL
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:5173'}/verify/certificate/${verificationToken}`;

  // Generate QR Code
  const qrCodeUrl = await generateQRCodeDataURL(verifyUrl);

  // 5. Generate PDF
  const pdfBuffer = await generateCertificatePDF(
    {
      recipientName: data.recipient_name,
      title: 'Certificate',
      subtitle: `Of ${data.domain} Internship Completion`,
      roleLine,
      domain: data.domain,
      dateRange: dateRangeText,
      body: pdfBody,
      issuer: data.issuer || 'InternOps',
      issueDate: new Date().toISOString().slice(0, 10),
      certificateType: 'internship',
      certificateNumber,

      // NEW
      qrCode: qrCodeUrl,
      verificationUrl: verifyUrl,
      certificateId: verificationToken,
    },
    templateData
  );

  // 6. Save PDF to disk
  const filename = `cert_${certificateNumber.replace(/\//g, '-')}_${Date.now()}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBuffer);

  // 7. Save certificate
  const cert = await repo.createCertificate(
    {
      template_id: data.template_id || null,
      recipient_name: data.recipient_name,
      title: `Certificate of ${data.domain} Internship`,
      body,
      issuer: data.issuer || 'InternOps',
      issue_date: new Date().toISOString().slice(0, 10),
      certificate_type: 'internship',
      status: 'generated',

      pdf_path: filename,
      qr_code_url: qrCodeUrl,
      verification_token: verificationToken,

      metadata: {
        certificate_number: certificateNumber,
        domain: data.domain,
        role: data.role || null,
        start_date: data.start_date,
        end_date: data.end_date,
        auto_generated: true,
      },
    },
    userId
  );

  return {
    success: true,
    data: {
      ...cert,
      certificate_number: certificateNumber,
      domain: data.domain,
      start_date: data.start_date,
      end_date: data.end_date,
      pdf_url: `/uploads/certificates/${filename}`,
      verification_token: verificationToken,
      verification_url: verifyUrl,
      qr_code_url: qrCodeUrl,
    },
  };
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

module.exports = {
  seedDefaultTemplates,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generateCertificate,
  listCertificates,
  getCertificate,
  verifyCertificate,
  deleteCertificate,
  revokeCertificate,
  startBulkGeneration,
  processBulkGeneration,
  getBulkJobStatus,
  generateAIContent,
  suggestTemplate,
  quickGenerate,
};
