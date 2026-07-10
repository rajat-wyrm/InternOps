ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at
  ON notifications(deleted_at)
  WHERE deleted_at IS NULL;
