-- Performance indexes for Reports page

-- Attendance Summary:
-- Filters by date and ignores deleted records.
CREATE INDEX IF NOT EXISTS idx_attendance_reports_date_active
ON attendance (date, user_id, status)
WHERE deleted_at IS NULL;

-- Ratings Summary:
-- Filters ratings by created_at and joins using rated_user_id.
CREATE INDEX IF NOT EXISTS idx_ratings_reports_created_active
ON ratings (created_at, rated_user_id, score)
WHERE deleted_at IS NULL;

-- Task Completion:
-- Joins proof submissions using task_id and checks status.
CREATE INDEX IF NOT EXISTS idx_proof_reports_task_status_active
ON proof_submissions (task_id, status)
WHERE deleted_at IS NULL;

-- Task Completion:
-- Only active tasks are required by the report.
CREATE INDEX IF NOT EXISTS idx_social_tasks_reports_active
ON social_tasks (id)
WHERE deleted_at IS NULL;