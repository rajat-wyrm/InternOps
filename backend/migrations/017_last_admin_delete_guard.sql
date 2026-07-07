-- Migration 017: Extend the last-active-admin invariant to cover soft deletes.
-- The existing check_last_admin() function (from 016) only blocked suspension.
-- This migration replaces it to also reject SET deleted_at = NOW() when the
-- target is the final active (non-suspended, non-deleted) ADMIN.

CREATE OR REPLACE FUNCTION check_last_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Block: suspending the last active admin
  IF NEW.role = 'ADMIN' AND NEW.suspended = TRUE AND OLD.suspended = FALSE
     AND OLD.deleted_at IS NULL THEN
    IF (
      SELECT COUNT(*)
      FROM users
      WHERE role = 'ADMIN'
        AND suspended = FALSE
        AND deleted_at IS NULL
        AND id <> OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'Cannot suspend the last active admin';
    END IF;
  END IF;

  -- Block: soft-deleting the last active admin
  IF NEW.role = 'ADMIN' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF (
      SELECT COUNT(*)
      FROM users
      WHERE role = 'ADMIN'
        AND suspended = FALSE
        AND deleted_at IS NULL
        AND id <> OLD.id
    ) = 0 THEN
      RAISE EXCEPTION 'Cannot delete the last active admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger itself is already in place from migration 016; replacing the
-- function body is sufficient. Re-create it anyway to be safe.
DROP TRIGGER IF EXISTS last_admin_guard ON users;

CREATE TRIGGER last_admin_guard
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION check_last_admin();
