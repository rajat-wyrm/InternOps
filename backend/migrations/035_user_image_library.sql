CREATE TABLE IF NOT EXISTS user_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path VARCHAR(500) NOT NULL UNIQUE,
  image_url VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255),
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_images_user_id
  ON user_images(user_id);

CREATE INDEX IF NOT EXISTS idx_user_images_active
  ON user_images(user_id)
  WHERE deleted_at IS NULL;