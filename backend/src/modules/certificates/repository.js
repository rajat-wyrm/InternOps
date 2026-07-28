const pool = require('../../config/db');
const logger = require('../../logger');

// ============================================================
// Templates
// ============================================================

async function createTemplate(data, userId) {
  logger.debug({ data }, 'Repository data for createTemplate');
  const res = await pool.query(
    `INSERT INTO certificate_templates (name, description,color_scheme, template_data, thumbnail_url, canva_design_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.name,
      data.description || null,
      JSON.stringify(data.colorScheme || []),
      JSON.stringify(data.template_data || {}),
      data.thumbnail_url || null,
      data.canva_design_id || null,
      userId,
    ]
  );
  return res.rows[0];
}

async function getTemplates(filters = {}) {
  let query = 'SELECT * FROM certificate_templates WHERE is_active = TRUE';
  const params = [];
  let idx = 1;

  if (filters.search) {
    query += ` AND (name ILIKE $${idx} OR description ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }

  query += ' ORDER BY created_at DESC';

  if (filters.limit) {
    query += ` LIMIT $${idx}`;
    params.push(filters.limit);
    idx++;
  }
  if (filters.offset) {
    query += ` OFFSET $${idx}`;
    params.push(filters.offset);
    idx++;
  }

  const res = await pool.query(query, params);
  return res.rows;
}

async function getTemplateById(id) {
  const res = await pool.query(
    'SELECT * FROM certificate_templates WHERE id = $1 AND is_active = TRUE',
    [id]
  );
  return res.rows[0] || null;
}

async function updateTemplate(id, data) {
  const fields = [];
  const params = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx}`);
    params.push(data.name);
    idx++;
  }
  if (data.description !== undefined) {
    fields.push(`description = $${idx}`);
    params.push(data.description);
    idx++;
  }
  if (data.template_data !== undefined) {
    fields.push(`template_data = $${idx}`);
    params.push(JSON.stringify(data.template_data));
    idx++;
  }
  if (data.thumbnail_url !== undefined) {
    fields.push(`thumbnail_url = $${idx}`);
    params.push(data.thumbnail_url);
    idx++;
  }
  if (data.canva_design_id !== undefined) {
    fields.push(`canva_design_id = $${idx}`);
    params.push(data.canva_design_id);
    idx++;
  }

  if (data.colorScheme !== undefined) {
    fields.push(`color_scheme = $${idx}`);
    params.push(JSON.stringify(data.colorScheme));
    idx++;
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  params.push(id);

  const res = await pool.query(
    `UPDATE certificate_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] || null;
}

async function deleteTemplate(id) {
  const res = await pool.query(
    'UPDATE certificate_templates SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
    [id]
  );
  return res.rows[0] || null;
}

// ============================================================
// Certificates
// ============================================================

async function createCertificate(data, userId) {
  const res = await pool.query(
    `INSERT INTO certificates (
    template_id,
    recipient_name,
    recipient_email,
    title,
    body,
    issuer,
    issue_date,
    expiry_date,
    certificate_type,
    status,
    pdf_path,
    qr_code_url,
    canva_design_id,
    metadata,
    created_by
)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      data.template_id || null,
      data.recipient_name,
      data.recipient_email || null,
      data.title,
      data.body || null,
      data.issuer || null,
      data.issue_date || new Date().toISOString().slice(0, 10),
      data.expiry_date || null,
      data.certificate_type || 'achievement',
      data.status || 'draft',
      data.pdf_path || null,
      data.qr_code_url || null,
      data.canva_design_id || null,
      JSON.stringify(data.metadata || {}),
      userId,
    ]
  );
  return res.rows[0];
}

async function getCertificateById(id) {
  const res = await pool.query(
    `SELECT c.*, t.name as template_name, t.template_data
     FROM certificates c
     LEFT JOIN certificate_templates t ON c.template_id = t.id
     WHERE c.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

async function listCertificates(filters = {}) {
  let query = `SELECT c.*, t.name as template_name
               FROM certificates c
               LEFT JOIN certificate_templates t ON c.template_id = t.id
               WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (filters.status) {
    query += ` AND c.status = $${idx}`;
    params.push(filters.status);
    idx++;
  }
  if (filters.certificate_type) {
    query += ` AND c.certificate_type = $${idx}`;
    params.push(filters.certificate_type);
    idx++;
  }
  if (filters.search) {
    query += ` AND (c.recipient_name ILIKE $${idx} OR c.recipient_email ILIKE $${idx} OR c.title ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.created_by) {
    query += ` AND c.created_by = $${idx}`;
    params.push(filters.created_by);
    idx++;
  }

  query += ' ORDER BY c.created_at DESC';

  if (filters.limit) {
    query += ` LIMIT $${idx}`;
    params.push(filters.limit);
    idx++;
  }
  if (filters.offset) {
    query += ` OFFSET $${idx}`;
    params.push(filters.offset);
    idx++;
  }

  const res = await pool.query(query, params);
  return res.rows;
}

async function updateCertificate(id, data) {
  const fields = [];
  const params = [];
  let idx = 1;

  const updatable = [
    'template_id',
    'recipient_name',
    'recipient_email',
    'title',
    'body',
    'issuer',
    'issue_date',
    'expiry_date',
    'certificate_type',
    'status',
    'pdf_path',
    'qr_code_url',
    'canva_design_id',
  ];
  for (const key of updatable) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      params.push(data[key]);
      idx++;
    }
  }
  if (data.metadata !== undefined) {
    fields.push(`metadata = $${idx}`);
    params.push(JSON.stringify(data.metadata));
    idx++;
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  params.push(id);

  const res = await pool.query(
    `UPDATE certificates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] || null;
}

async function deleteCertificate(id) {
  const res = await pool.query(
    'DELETE FROM certificates WHERE id = $1 RETURNING id',
    [id]
  );
  return res.rows[0] || null;
}

// ============================================================
// Bulk Jobs
// ============================================================

async function createBulkJob(data, userId) {
  const res = await pool.query(
    `INSERT INTO bulk_jobs (template_id, csv_filename, total_count, send_email, email_subject, email_body, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.template_id,
      data.csv_filename || null,
      data.total_count || 0,
      data.send_email || false,
      data.email_subject || null,
      data.email_body || null,
      userId,
    ]
  );
  return res.rows[0];
}

async function getBulkJobById(id) {
  const res = await pool.query('SELECT * FROM bulk_jobs WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function updateBulkJob(id, data) {
  const fields = [];
  const params = [];
  let idx = 1;

  if (data.status !== undefined) {
    fields.push(`status = $${idx}`);
    params.push(data.status);
    idx++;
  }
  if (data.completed_count !== undefined) {
    fields.push(`completed_count = $${idx}`);
    params.push(data.completed_count);
    idx++;
  }
  if (data.failed_count !== undefined) {
    fields.push(`failed_count = $${idx}`);
    params.push(data.failed_count);
    idx++;
  }
  if (data.error_log !== undefined) {
    fields.push(`error_log = $${idx}`);
    params.push(JSON.stringify(data.error_log));
    idx++;
  }
  if (data.completed_at !== undefined) {
    fields.push(`completed_at = $${idx}`);
    params.push(data.completed_at);
    idx++;
  }

  if (fields.length === 0) return null;
  params.push(id);

  const res = await pool.query(
    `UPDATE bulk_jobs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] || null;
}

async function createBulkJobItem(data) {
  const res = await pool.query(
    `INSERT INTO bulk_job_items (bulk_job_id, certificate_id, recipient_name, recipient_email, row_data, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.bulk_job_id,
      data.certificate_id || null,
      data.recipient_name,
      data.recipient_email || null,
      JSON.stringify(data.row_data || {}),
      data.status || 'pending',
    ]
  );
  return res.rows[0];
}

async function updateBulkJobItem(id, data) {
  const fields = [];
  const params = [];
  let idx = 1;

  if (data.certificate_id !== undefined) {
    fields.push(`certificate_id = $${idx}`);
    params.push(data.certificate_id);
    idx++;
  }
  if (data.status !== undefined) {
    fields.push(`status = $${idx}`);
    params.push(data.status);
    idx++;
  }
  if (data.error_message !== undefined) {
    fields.push(`error_message = $${idx}`);
    params.push(data.error_message);
    idx++;
  }

  if (fields.length === 0) return null;
  params.push(id);

  const res = await pool.query(
    `UPDATE bulk_job_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return res.rows[0] || null;
}

async function getBulkJobItems(bulkJobId) {
  const res = await pool.query(
    'SELECT * FROM bulk_job_items WHERE bulk_job_id = $1 ORDER BY created_at',
    [bulkJobId]
  );
  return res.rows;
}

// ============================================================
// Canva Settings
// ============================================================

async function getCanvaSettings() {
  const res = await pool.query(
    'SELECT * FROM canva_settings WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1'
  );
  return res.rows[0] || null;
}

async function saveCanvaSettings(data, userId) {
  const existing = await getCanvaSettings();
  if (existing) {
    const res = await pool.query(
      `UPDATE canva_settings SET access_token = $1, refresh_token = $2, token_expires_at = $3, organization_id = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [
        data.access_token,
        data.refresh_token,
        data.token_expires_at,
        data.organization_id,
        existing.id,
      ]
    );
    return res.rows[0];
  }
  const res = await pool.query(
    `INSERT INTO canva_settings (access_token, refresh_token, token_expires_at, organization_id, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      data.access_token,
      data.refresh_token,
      data.token_expires_at,
      data.organization_id,
      userId,
    ]
  );
  return res.rows[0];
}

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  createCertificate,
  getCertificateById,
  listCertificates,
  updateCertificate,
  deleteCertificate,
  createBulkJob,
  getBulkJobById,
  updateBulkJob,
  createBulkJobItem,
  updateBulkJobItem,
  getBulkJobItems,
  getCanvaSettings,
  saveCanvaSettings,
};
