ALTER TABLE users
  ADD COLUMN IF NOT EXISTS lifecycle_effective_date DATE,
  ADD COLUMN IF NOT EXISTS completion_date DATE,
  ADD COLUMN IF NOT EXISTS extended_completion_date DATE;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_internship_status_check;
ALTER TABLE users ADD CONSTRAINT users_internship_status_check
  CHECK (internship_status IS NULL OR internship_status IN
    ('ACTIVE','ON_HOLD','COMPLETED','TERMINATED','DISCONTINUED'));
ALTER TABLE users ADD CONSTRAINT users_lifecycle_dates_check CHECK (
  extended_completion_date IS NULL OR completion_date IS NULL OR
  extended_completion_date >= completion_date
);
CREATE INDEX IF NOT EXISTS idx_users_internship_lifecycle
  ON users(internship_status, lifecycle_effective_date, completion_date, extended_completion_date)
  WHERE deleted_at IS NULL;
