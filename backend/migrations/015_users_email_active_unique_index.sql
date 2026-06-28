-- Drop the global unique constraint on users(email)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Create a partial unique index on email scoped to non-deleted users
CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_key
  ON users (email)
  WHERE deleted_at IS NULL;
