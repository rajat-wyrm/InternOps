-- Persist bounced email addresses so suppression survives process restarts.
-- Records can be reviewed and cleared by admins directly in the database.

CREATE TABLE IF NOT EXISTS bounced_emails (
  email       TEXT        NOT NULL,
  bounced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason      TEXT,
  PRIMARY KEY (email)
);

CREATE INDEX IF NOT EXISTS bounced_emails_bounced_at_idx
  ON bounced_emails (bounced_at);
