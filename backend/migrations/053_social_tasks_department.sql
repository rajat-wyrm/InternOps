-- Associate manually created social tasks with an explicit department scope.
ALTER TABLE social_tasks
  ADD COLUMN IF NOT EXISTS department_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_tasks_department_id_fkey'
      AND conrelid = 'social_tasks'::regclass
  ) THEN
    ALTER TABLE social_tasks
      ADD CONSTRAINT social_tasks_department_id_fkey
      FOREIGN KEY (department_id)
      REFERENCES departments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_social_tasks_department_id
  ON social_tasks(department_id)
  WHERE deleted_at IS NULL;
