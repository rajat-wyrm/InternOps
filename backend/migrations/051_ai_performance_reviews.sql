-- Migration 051: AI Performance Reviews Historical Storage
CREATE TABLE IF NOT EXISTS ai_performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intern_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_period_start TIMESTAMPTZ NOT NULL,
  review_period_end TIMESTAMPTZ NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL,
  performance_level VARCHAR(50) NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.85,
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  summary TEXT,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  deterministic_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  development_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  recurring_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  learning_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  early_warning JSONB NOT NULL DEFAULT '{}'::jsonb,
  performance_trend JSONB NOT NULL DEFAULT '{}'::jsonb,
  manager_summary TEXT,
  intern_feedback TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_provider VARCHAR(50) DEFAULT 'gemini',
  model_name VARCHAR(100) DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_perf_reviews_intern
  ON ai_performance_reviews(intern_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_perf_reviews_period
  ON ai_performance_reviews(intern_id, review_period_start, review_period_end);
