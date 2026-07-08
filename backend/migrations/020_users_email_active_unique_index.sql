ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_key
ON users (LOWER(email))
WHERE deleted_at IS NULL;