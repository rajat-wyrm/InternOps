CREATE INDEX IF NOT EXISTS idx_audit_created_id
  ON audit_logs (created_at DESC, id DESC);