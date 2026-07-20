CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

  successful_requests INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id
  ON ai_usage(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_date
  ON ai_usage(usage_date);