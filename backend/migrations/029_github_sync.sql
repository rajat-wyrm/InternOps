ALTER TABLE social_tasks
  ADD COLUMN IF NOT EXISTS github_issue_id BIGINT,
  ADD COLUMN IF NOT EXISTS github_issue_number INTEGER,
  ADD COLUMN IF NOT EXISTS github_repo VARCHAR(255),
  ADD COLUMN IF NOT EXISTS github_issue_url TEXT,
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS github_labels JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_social_tasks_github_issue_id
  ON social_tasks(github_issue_id)
  WHERE github_issue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_tasks_source
  ON social_tasks(source);

CREATE TABLE IF NOT EXISTS github_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  github_issue_id BIGINT,
  github_issue_number INTEGER,
  github_repo VARCHAR(255),
  task_id UUID REFERENCES social_tasks(id),
  status VARCHAR(50) NOT NULL DEFAULT 'success',
  message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  triggered_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_sync_log_created_at
  ON github_sync_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_github_sync_log_status
  ON github_sync_log(status);

ALTER TABLE task_assignments
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS github_sync_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repo VARCHAR(255) NOT NULL,
  webhook_secret VARCHAR(255),
  github_token VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_ping_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  total_issues_synced INTEGER DEFAULT 0,
  failed_syncs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
