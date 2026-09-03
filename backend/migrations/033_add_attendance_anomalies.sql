-- 032_add_attendance_anomalies.sql

-- 1. Add arrival_time to attendance table if it doesn't already exist
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS arrival_time TIME WITHOUT TIME ZONE;

-- 2. Create attendance_exemptions table for false positive prevention
CREATE TABLE IF NOT EXISTS attendance_exemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL means public holiday / company-wide holiday
  exemption_date DATE NOT NULL,
  exemption_type VARCHAR(100) NOT NULL, -- 'LEAVE', 'PUBLIC_HOLIDAY', 'COMPANY_HOLIDAY', 'SCHEDULE_EXCEPTION', 'TIME_ZONE_ADJUSTMENT', 'OTHER'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique constraint: only one exemption per date for global/user
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_exemptions_user_date_null 
  ON attendance_exemptions (exemption_date) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_exemptions_user_date 
  ON attendance_exemptions (user_id, exemption_date) WHERE user_id IS NOT NULL;

-- 3. Create attendance_anomalies table for logging AI detections
CREATE TABLE IF NOT EXISTS attendance_anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intern_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag_type VARCHAR(100) NOT NULL, -- 'repetitive_late_pattern', 'unusual_absence_pattern', 'attendance_outlier', 'suspicious_consistency'
  severity VARCHAR(50) NOT NULL, -- 'low', 'medium', 'high'
  reason TEXT NOT NULL,
  details JSONB,
  viewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ,
  notification_status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance and rapid filtering
CREATE INDEX IF NOT EXISTS idx_attendance_anomalies_intern ON attendance_anomalies(intern_id);
CREATE INDEX IF NOT EXISTS idx_attendance_anomalies_created_at ON attendance_anomalies(created_at);
