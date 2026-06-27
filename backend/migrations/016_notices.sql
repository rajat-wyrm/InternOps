-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE notices (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(255)  NOT NULL,
  content       TEXT          NOT NULL,
  category      VARCHAR(50)   NOT NULL DEFAULT 'GENERAL',
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by    UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- Index for the public endpoint query — filters by is_active and deleted_at constantly
CREATE INDEX idx_notices_active ON notices (is_active, deleted_at);

COMMENT ON COLUMN notices.category    IS 'GENERAL | REMINDER | NEWS | ALERT';
COMMENT ON COLUMN notices.is_active   IS 'FALSE = unpublished but not deleted';
COMMENT ON COLUMN notices.deleted_at  IS 'NULL = not deleted (soft delete pattern)';