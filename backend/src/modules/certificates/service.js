const repo = require('./repository');
const { generateCertificatePDF } = require('./pdf');
const { generateQRCodeDataURL } = require('./qr');
const { DEFAULT_TEMPLATES } = require('./templates');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'uploads',
  'certificates'
);

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

  // Generate QR code for verification
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:5173'}/verify/certificate`;
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
    },
    userId
  );

  return {
    success: true,
    data: {
      ...cert,
      pdf_url: `/uploads/certificates/${filename}`,
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

// ============================================================
// Bulk Generation Service
// ============================================================

async function startBulkGeneration(data, userId) {
  const job = await repo.createBulkJob(
    {
      template_id: data.template_id,
      total_count: data.certificates.length,
      send_email: data.send_email,
      email_subject: data.email_subject,
      email_body: data.email_body,
    },
    userId
  );

  // Process certificates synchronously for now (can be made async with a job queue)
  const results = { generated: 0, failed: 0, errors: [] };

  for (const certData of data.certificates) {
    try {
      const cert = await generateCertificate(
        {
          template_id: data.template_id,
          recipient_name: certData.recipient_name,
          recipient_email: certData.recipient_email,
          title: certData.title || 'Certificate of Achievement',
          body: certData.body,
          issuer: certData.issuer,
          certificate_type: certData.certificate_type || 'achievement',
          metadata: certData.metadata,
        },
        userId
      );

      await repo.createBulkJobItem({
        bulk_job_id: job.id,
        certificate_id: cert.data.id,
        recipient_name: certData.recipient_name,
        recipient_email: certData.recipient_email,
        row_data: certData,
        status: 'generated',
      });

      results.generated++;
    } catch (err) {
      await repo.createBulkJobItem({
        bulk_job_id: job.id,
        recipient_name: certData.recipient_name,
        recipient_email: certData.recipient_email,
        row_data: certData,
        status: 'failed',
        error_message: err.message,
      });

      results.failed++;
      results.errors.push({
        recipient: certData.recipient_name,
        error: err.message,
      });
    }
  }

  // Update job status
  await repo.updateBulkJob(job.id, {
    status: 'completed',
    completed_count: results.generated,
    failed_count: results.failed,
    error_log: results.errors,
    completed_at: new Date().toISOString(),
  });

  return {
    success: true,
    data: {
      job_id: job.id,
      total: data.certificates.length,
      generated: results.generated,
      failed: results.failed,
      errors: results.errors,
    },
  };
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

  const prompt = `Generate professional certificate text for a ${data.type} certificate.
Recipient: ${data.name}
Company/Organization: ${data.company}
Achievement: ${data.achievement}
Tone: ${data.tone || 'formal'}
Language: ${data.language || 'English'}

Return a JSON object with:
- "title": The certificate title (e.g., "Certificate of Excellence")
- "body": The certificate body text (2-3 sentences describing the achievement)
- "footer": A footer line (e.g., "Awarded on [date]" or a closing statement)`;

  try {
    const result = await aiProvider.generate(prompt);
    const parsed = JSON.parse(result);
    return { success: true, data: parsed };
  } catch {
    return {
      success: true,
      data: {
        title: `Certificate of ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}`,
        body: `This certificate is proudly presented to ${data.name} from ${data.company} in recognition of ${data.achievement}.`,
        footer: `Awarded on ${new Date().toISOString().slice(0, 10)}`,
      },
    };
  }
}

async function suggestTemplate(data) {
  const aiProvider = require('../../services/aiProviderService');

  const templates = await repo.getTemplates({ limit: 10 });
  const templateNames = templates.map((t) => t.name).join(', ');

  const prompt = `Given an achievement: "${data.achievement}" of type "${data.type}", which of these certificate templates would be most appropriate?
Available templates: ${templateNames}

Return just the template name that best matches.`;

  try {
    const result = await aiProvider.generate(prompt);
    const matched = templates.find((t) => result.includes(t.name));
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
    ? `has successfully completed their internship as ${data.role} of domain`
    : 'has successfully completed their internship in the domain of';
  const dateRangeText = `from ${startFormatted} to ${endFormatted}`;
  const pdfBody =
    'During this period, the candidate demonstrated exemplary professional standards, technical proficiency, and significant contribution to our organizational goals.';
  // 4. Generate PDF
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
    },
    templateData
  );

  // 5. Generate QR code
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:5173'}/verify/certificate`;
  const qrCodeUrl = await generateQRCodeDataURL(verifyUrl);

  // 6. Save PDF to disk
  const filename = `cert_${certificateNumber.replace(/\//g, '-')}_${Date.now()}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBuffer);

  // 7. Save to database
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
    },
  };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
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
  deleteCertificate,
  startBulkGeneration,
  getBulkJobStatus,
  generateAIContent,
  suggestTemplate,
  quickGenerate,
};
