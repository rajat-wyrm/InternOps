ALTER TABLE notices
ADD COLUMN IF NOT EXISTS image_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS action_button_text VARCHAR(50),
ADD COLUMN IF NOT EXISTS action_button_link VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN notices.image_url IS 'Optional URL for the notice banner/thumbnail image';
COMMENT ON COLUMN notices.action_button_text IS 'Optional text for an action button (e.g. Apply Now)';
COMMENT ON COLUMN notices.action_button_link IS 'Optional URL for the action button destination';
COMMENT ON COLUMN notices.is_featured IS 'If TRUE, notice is displayed prominently at the top of the board';
