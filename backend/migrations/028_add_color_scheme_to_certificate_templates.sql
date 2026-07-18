ALTER TABLE certificate_templates
ADD COLUMN color_scheme JSONB DEFAULT '[]'::jsonb;
