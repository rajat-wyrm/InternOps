ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'LEAVE';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'INFORMED';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intern_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS users_active_intern_code_key
  ON users (UPPER(intern_code)) WHERE intern_code IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS rating_period VARCHAR(160),
  ADD COLUMN IF NOT EXISTS source_sheet VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_row INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS ratings_import_period_key
  ON ratings (rated_user_id, rating_period)
  WHERE deleted_at IS NULL AND rating_period IS NOT NULL;

CREATE TABLE IF NOT EXISTS workbook_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workbook_fingerprint CHAR(64) NOT NULL,
  email_workbook_fingerprint CHAR(64) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  manager_id UUID NOT NULL REFERENCES users(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS workbook_import_completed_key
  ON workbook_import_batches(workbook_fingerprint,email_workbook_fingerprint,department_id,manager_id)
  WHERE status='COMPLETED';
