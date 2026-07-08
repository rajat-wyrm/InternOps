-- ============================================================
-- Migration: Add Certificate Generation & Canva Integration Tables
-- ============================================================

-- Certificate templates (admin-created or Canva-imported)
CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  canva_design_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated certificates
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL,
  recipient_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  issuer VARCHAR(255),
  issue_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  certificate_type VARCHAR(50) NOT NULL DEFAULT 'achievement',
  status VARCHAR(20) DEFAULT 'draft',
  pdf_path TEXT,
  qr_code_url TEXT,
  canva_design_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bulk generation jobs
CREATE TABLE IF NOT EXISTS bulk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL,
  csv_filename VARCHAR(255),
  total_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  send_email BOOLEAN DEFAULT FALSE,
  email_subject VARCHAR(500),
  email_body TEXT,
  error_log JSONB DEFAULT '[]',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Bulk job individual items
CREATE TABLE IF NOT EXISTS bulk_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_job_id UUID REFERENCES bulk_jobs(id) ON DELETE CASCADE,
  certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
  recipient_name VARCHAR(255),
  recipient_email VARCHAR(255),
  row_data JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canva integration settings
CREATE TABLE IF NOT EXISTS canva_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  organization_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_certificates_created_by ON certificates(created_by);
CREATE INDEX IF NOT EXISTS idx_certificates_template_id ON certificates(template_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_email ON certificates(recipient_email);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_created_by ON bulk_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status ON bulk_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_job_items_bulk_job_id ON bulk_job_items(bulk_job_id);
CREATE INDEX IF NOT EXISTS idx_certificate_templates_created_by ON certificate_templates(created_by);
