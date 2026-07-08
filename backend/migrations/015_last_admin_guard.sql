-- Migration 016: Database-level guard against suspending the last active admin.
-- This enforces the invariant even if application-level checks are bypassed
-- by future routes or direct SQL access.

CREATE OR REPLACE FUNCTION check_last_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when suspended is being set to TRUE on an ADMIN row
  IF NEW.role = 'ADMIN' AND NEW.suspended = TRUE AND OLD.suspended = FALSE THEN
    -- Count remaining active admins *excluding* the row being updated
    IF (
      SELECT COUNT(*)
      FROM users
      WHERE role = 'ADMIN'
        AND suspended = FALSE
        AND deleted_at IS NULL
        AND id <> NEW.id
    ) = 0 THEN
      RAISE EXCEPTION 'Cannot suspend the last active admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS last_admin_guard ON users;

CREATE TRIGGER last_admin_guard
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION check_last_admin();
