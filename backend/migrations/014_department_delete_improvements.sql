-- Make department_id NULL automatically when a department is hard deleted
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_department_id_fkey;

ALTER TABLE users
ADD CONSTRAINT users_department_id_fkey
FOREIGN KEY (department_id)
REFERENCES departments(id)
ON DELETE SET NULL;

-- Allow re-creating a soft-deleted department with the same name
ALTER TABLE departments
DROP CONSTRAINT IF EXISTS departments_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS departments_name_active_idx
ON departments (name)
WHERE deleted_at IS NULL;