-- Feature flags table
-- Stores runtime overrides for feature toggles.
-- Keys must match an entry in modules/feature-flags/flags.config.js.
-- Evaluation priority: enabled (DB) → rollout_pct → allowed_roles → static default.

CREATE TABLE IF NOT EXISTS feature_flags (
  key           VARCHAR(100) PRIMARY KEY,
  enabled       BOOLEAN      NOT NULL DEFAULT FALSE,
  rollout_pct   INTEGER      NOT NULL DEFAULT 100
                  CHECK (rollout_pct BETWEEN 0 AND 100),
  allowed_roles JSONB,         -- null = all roles; e.g. '["ADMIN","SENIOR_TL"]'
  description   TEXT,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by    UUID         REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);

-- Seed rows for all currently-defined flags so the DB is in sync with
-- flags.config.js immediately after migration. New flags added later in
-- flags.config.js will be auto-upserted by the service on first evaluation.
INSERT INTO feature_flags (key, enabled, rollout_pct, description)
VALUES
  ('NEW_DASHBOARD_V2',   FALSE, 100, 'Redesigned dashboard v2 UI'),
  ('AI_CERT_GENERATOR',  TRUE,  100, 'AI-powered certificate generation'),
  ('BULK_EXPORT_V2',     FALSE, 100, 'Improved bulk export with async queue'),
  ('CANVA_INTEGRATION',  TRUE,  100, 'Canva template-based certificate builder'),
  ('ADVANCED_ANALYTICS', FALSE, 100, 'Advanced analytics charts and KPIs'),
  ('MEETING_RECORDINGS', FALSE, 100, 'Meeting recording upload and playback')
ON CONFLICT (key) DO NOTHING;
