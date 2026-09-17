CREATE TABLE IF NOT EXISTS refresh_token_recovery (
  consumed_token_hash VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  replacement_token_hash VARCHAR(255) NOT NULL,
  client_fingerprint VARCHAR(64) NOT NULL,
  encrypted_payload TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_recovery_user
  ON refresh_token_recovery(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_token_recovery_expiry
  ON refresh_token_recovery(expires_at);

DELETE FROM refresh_token_recovery
WHERE expires_at <= NOW();
