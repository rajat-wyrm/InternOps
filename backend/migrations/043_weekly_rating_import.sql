BEGIN;
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_score_check;
ALTER TABLE ratings ALTER COLUMN score TYPE NUMERIC(3,1) USING score::numeric;
ALTER TABLE ratings ADD CONSTRAINT ratings_score_check CHECK (score >= 1 AND score <= 10);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rating_period_start DATE;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rating_period_end DATE;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS source_sheet TEXT;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS source_row INTEGER;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS source_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ratings_source_key_active_unique
  ON ratings(source_key) WHERE deleted_at IS NULL AND source_key IS NOT NULL;
COMMIT;
