CREATE TABLE IF NOT EXISTS image_metadata (
    id SERIAL PRIMARY KEY,
    intern_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_image_metadata_intern
        FOREIGN KEY (intern_id)
        REFERENCES interns(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_image_metadata_intern_id
ON image_metadata(intern_id);