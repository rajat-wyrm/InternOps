-- Add explicit ON DELETE behavior to user/task related foreign keys.
-- This avoids hard-delete integrity failures and makes deletion behavior clear.

-- attendance.user_id -> users.id
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS attendance_user_id_fkey;

ALTER TABLE attendance
ADD CONSTRAINT attendance_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- attendance.marked_by -> users.id
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS attendance_marked_by_fkey;

ALTER TABLE attendance
ADD CONSTRAINT attendance_marked_by_fkey
FOREIGN KEY (marked_by)
REFERENCES users(id)
ON DELETE CASCADE;

-- ratings.rated_user_id -> users.id
ALTER TABLE ratings
DROP CONSTRAINT IF EXISTS ratings_rated_user_id_fkey;

ALTER TABLE ratings
ADD CONSTRAINT ratings_rated_user_id_fkey
FOREIGN KEY (rated_user_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- ratings.rated_by -> users.id
ALTER TABLE ratings
DROP CONSTRAINT IF EXISTS ratings_rated_by_fkey;

ALTER TABLE ratings
ADD CONSTRAINT ratings_rated_by_fkey
FOREIGN KEY (rated_by)
REFERENCES users(id)
ON DELETE CASCADE;

-- social_tasks.created_by -> users.id
ALTER TABLE social_tasks
DROP CONSTRAINT IF EXISTS social_tasks_created_by_fkey;

ALTER TABLE social_tasks
ADD CONSTRAINT social_tasks_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES users(id)
ON DELETE CASCADE;

-- proof_submissions.task_id -> social_tasks.id
ALTER TABLE proof_submissions
DROP CONSTRAINT IF EXISTS proof_submissions_task_id_fkey;

ALTER TABLE proof_submissions
ADD CONSTRAINT proof_submissions_task_id_fkey
FOREIGN KEY (task_id)
REFERENCES social_tasks(id)
ON DELETE CASCADE;

-- proof_submissions.intern_id -> users.id
ALTER TABLE proof_submissions
DROP CONSTRAINT IF EXISTS proof_submissions_intern_id_fkey;

ALTER TABLE proof_submissions
ADD CONSTRAINT proof_submissions_intern_id_fkey
FOREIGN KEY (intern_id)
REFERENCES users(id)
ON DELETE CASCADE;

-- proof_submissions.verified_by -> users.id
-- verified_by is nullable, so keep the proof record but clear verifier link.
ALTER TABLE proof_submissions
DROP CONSTRAINT IF EXISTS proof_submissions_verified_by_fkey;

ALTER TABLE proof_submissions
ADD CONSTRAINT proof_submissions_verified_by_fkey
FOREIGN KEY (verified_by)
REFERENCES users(id)
ON DELETE SET NULL;