-- Focused indexes for bounded recursive hierarchy lookups.
-- The schema stores hierarchy edges as users.manager_id -> users.id.

CREATE INDEX IF NOT EXISTS idx_users_hierarchy_parent_child_active
ON users (manager_id, id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_hierarchy_parent_rank_active
ON users (
  manager_id,
  (CASE role
    WHEN 'ADMIN' THEN 0
    WHEN 'SENIOR_TL' THEN 1
    WHEN 'TL' THEN 2
    WHEN 'CAPTAIN' THEN 3
    WHEN 'INTERN' THEN 4
    ELSE 5
  END),
  (LOWER(COALESCE(NULLIF(TRIM(full_name), ''), email))),
  (LOWER(email)),
  id
)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_hierarchy_department_rank_active
ON users (
  department_id,
  (CASE role
    WHEN 'ADMIN' THEN 0
    WHEN 'SENIOR_TL' THEN 1
    WHEN 'TL' THEN 2
    WHEN 'CAPTAIN' THEN 3
    WHEN 'INTERN' THEN 4
    ELSE 5
  END),
  (LOWER(COALESCE(NULLIF(TRIM(full_name), ''), email))),
  (LOWER(email)),
  id
)
WHERE deleted_at IS NULL AND role <> 'ADMIN';

CREATE INDEX IF NOT EXISTS idx_proof_submissions_pending_intern_created_active
ON proof_submissions (intern_id, created_at DESC)
WHERE deleted_at IS NULL AND status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_attendance_anomalies_intern_created
ON attendance_anomalies (intern_id, created_at DESC);
