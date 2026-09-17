BEGIN;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS manual_period_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ratings_manual_period_active_unique
  ON ratings (rated_user_id, manual_period_key)
  WHERE deleted_at IS NULL AND manual_period_key IS NOT NULL;
COMMIT;
