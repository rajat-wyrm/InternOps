BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE role = 'SENIOR_TL' AND deleted_at IS NULL
    GROUP BY department_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one Senior TL per department: duplicate active Senior TL records exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_one_senior_tl_per_department
  ON users (department_id)
  WHERE role = 'SENIOR_TL' AND deleted_at IS NULL AND department_id IS NOT NULL;

COMMIT;
