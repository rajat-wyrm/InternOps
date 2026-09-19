CREATE TABLE revoked_access_tokens (
  jti VARCHAR(128) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revoked_access_tokens_user
  ON revoked_access_tokens(user_id);

CREATE INDEX idx_revoked_access_tokens_expiry
  ON revoked_access_tokens(expires_at);
