ALTER TABLE image_metadata
DROP CONSTRAINT IF EXISTS fk_image_metadata_intern;

DROP INDEX IF EXISTS idx_image_metadata_intern_id;

ALTER TABLE image_metadata
DROP COLUMN intern_id;

ALTER TABLE image_metadata
ADD COLUMN user_id UUID NOT NULL;

ALTER TABLE image_metadata
ADD CONSTRAINT fk_image_metadata_user
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_image_metadata_user_id
ON image_metadata(user_id);