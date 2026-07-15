ALTER TABLE social_tasks
  ADD COLUMN reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_social_tasks_deadline_reminder
  ON social_tasks (deadline)
  WHERE deadline IS NOT NULL AND reminder_sent_at IS NULL AND deleted_at IS NULL;
