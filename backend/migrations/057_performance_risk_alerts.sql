-- Migration 054: AI Performance Risk Scoring & Proactive Alert Tables

-- -----------------------------------------------------------------------
-- performance_risk_scores: stores computed risk predictions per intern.
-- Both the latest and historical snapshots live here; a partial index
-- on (intern_id, is_latest=TRUE) makes point lookups fast.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS performance_risk_scores (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intern_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Core prediction output
  risk_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_level           VARCHAR(20) NOT NULL DEFAULT 'VERY_LOW',
  performance_score    NUMERIC(5,2) NOT NULL DEFAULT 0,
  performance_level    VARCHAR(50) NOT NULL DEFAULT 'Insufficient Data',
  confidence           NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  data_quality         VARCHAR(20) NOT NULL DEFAULT 'INSUFFICIENT', -- INSUFFICIENT | LIMITED | MODERATE | GOOD | HIGH

  -- Trend
  trend_direction      VARCHAR(20) NOT NULL DEFAULT 'stable', -- improving | stable | declining | rapidly_declining | insufficient_data
  trend_change         NUMERIC(5,2) DEFAULT 0,
  previous_risk_score  NUMERIC(5,2) DEFAULT NULL,

  -- Explainability
  factors              JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{factor, impact, description, value}]
  predictions          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{type, probability, label, confidence}]
  feature_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- raw features used

  -- Signal counts (for data quality assessment)
  signal_count         INTEGER NOT NULL DEFAULT 0,
  attendance_days      INTEGER NOT NULL DEFAULT 0,
  tasks_assigned       INTEGER NOT NULL DEFAULT 0,
  ratings_count        INTEGER NOT NULL DEFAULT 0,

  -- Tracking
  is_latest            BOOLEAN NOT NULL DEFAULT TRUE,
  model_version        VARCHAR(50) NOT NULL DEFAULT 'v1.0-deterministic',
  computed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start         TIMESTAMPTZ,
  period_end           TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup for current risk of a specific intern
CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_risk_intern_latest
  ON performance_risk_scores(intern_id)
  WHERE is_latest = TRUE;

-- History queries: intern + time
CREATE INDEX IF NOT EXISTS idx_perf_risk_intern_time
  ON performance_risk_scores(intern_id, computed_at DESC);

-- Dashboard queries: risk level filtering
CREATE INDEX IF NOT EXISTS idx_perf_risk_level
  ON performance_risk_scores(risk_level, computed_at DESC)
  WHERE is_latest = TRUE;

-- -----------------------------------------------------------------------
-- performance_alerts: proactive alert records with deduplication.
-- One active alert per (intern_id, alert_type) at a time.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS performance_alerts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intern_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  alert_type       VARCHAR(50) NOT NULL,
  -- e.g. CRITICAL_RISK | HIGH_RISK | DEADLINE_RISK | ATTENDANCE_RISK
  --      TASK_COMPLETION_RISK | PERFORMANCE_DECLINE | INACTIVITY

  severity         VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
  -- INFO | LOW | MEDIUM | HIGH | CRITICAL

  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  recommendation   TEXT NOT NULL,
  factors          JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Risk scores at time of alert
  risk_score_at_alert  NUMERIC(5,2),
  confidence_at_alert  NUMERIC(3,2),

  -- Alert state lifecycle
  status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  -- ACTIVE | ACKNOWLEDGED | RESOLVED | EXPIRED

  -- Cooldown: prevent duplicate alerts within a window
  cooldown_until   TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_count    INTEGER NOT NULL DEFAULT 1,

  -- Optional: who acted on this alert
  acknowledged_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at  TIMESTAMPTZ,
  resolved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deduplication: only one ACTIVE alert per (intern, type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_alerts_active_dedup
  ON performance_alerts(intern_id, alert_type)
  WHERE status = 'ACTIVE';

-- RBAC/query: alerts for an intern
CREATE INDEX IF NOT EXISTS idx_perf_alerts_intern
  ON performance_alerts(intern_id, status, created_at DESC);

-- Dashboard: all active alerts sorted by severity/time
CREATE INDEX IF NOT EXISTS idx_perf_alerts_active
  ON performance_alerts(status, severity, created_at DESC)
  WHERE status = 'ACTIVE';

-- -----------------------------------------------------------------------
-- performance_alert_events: immutable audit trail of alert state changes.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS performance_alert_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id   UUID NOT NULL REFERENCES performance_alerts(id) ON DELETE CASCADE,
  intern_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,

  event_type VARCHAR(30) NOT NULL,
  -- CREATED | UPDATED | SEVERITY_ESCALATED | ACKNOWLEDGED | RESOLVED | EXPIRED | RETRIGGERED

  old_status    VARCHAR(20),
  new_status    VARCHAR(20),
  old_severity  VARCHAR(10),
  new_severity  VARCHAR(10),
  details       JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_alert_events_alert
  ON performance_alert_events(alert_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_perf_alert_events_intern
  ON performance_alert_events(intern_id, created_at DESC);
