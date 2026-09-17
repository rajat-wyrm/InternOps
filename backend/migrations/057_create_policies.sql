-- Policy database for AIML chatbot integration (see issue #2062).
--
-- `policies` holds the canonical company policy documents that the AIML
-- chatbot draws its answers from. `is_sensitive` marks policies that must
-- only be surfaced to elevated roles (RBAC-checked in the AI service).
--
-- `policy_chat_audit_log` records every policy-related chatbot interaction
-- (question asked, policies consulted, requester) for audit purposes, per
-- the issue's acceptance criteria.

CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,

  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_category
  ON policies(category);

CREATE INDEX IF NOT EXISTS idx_policies_active
  ON policies(is_active);

CREATE TABLE IF NOT EXISTS policy_chat_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  policy_ids UUID[] NOT NULL DEFAULT '{}',
  answered_from_cache BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_chat_audit_log_user_id
  ON policy_chat_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_policy_chat_audit_log_created_at
  ON policy_chat_audit_log(created_at);
