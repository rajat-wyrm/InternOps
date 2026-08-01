CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  provider TEXT NOT NULL,
  model TEXT NOT NULL,

  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL,
  status TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id
  ON ai_usage_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider
  ON ai_usage_logs(provider);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON ai_usage_logs(created_at);
