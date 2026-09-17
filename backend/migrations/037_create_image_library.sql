CREATE TABLE IF NOT EXISTS image_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_image_library_user_id
  ON image_library(user_id);

CREATE INDEX IF NOT EXISTS idx_image_library_created_at
  ON image_library(created_at);

CREATE INDEX IF NOT EXISTS idx_image_library_deleted_at
  ON image_library(deleted_at);
