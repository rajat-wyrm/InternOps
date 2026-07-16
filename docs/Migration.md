# Database Migrations

## Purpose

This document provides detailed guidance specifically for running,
locking, and rolling back database migrations in InternOps. For
general deployment steps, see the main Operations Runbook.

---

# Running Migrations

Migrations run as an explicit, separate step — never automatically on
application startup.

```bash
npm run migrate
```

In production (via Docker), this is run automatically by
`start-production.ps1`, or manually:

```bash
docker-compose exec backend npm run migrate
```

This command is idempotent and safe to re-run:

- Already-applied migrations are skipped, tracked by name and SHA-256
  checksum in the `_migrations` and `_migration_checksums` tables.
- A Postgres advisory lock (`pg_advisory_lock`) prevents two
  concurrent runs from racing each other — if a second instance
  attempts to migrate while another is in progress, it simply waits
  until the first one finishes.

---

# Migration Rollback Procedure

This project does not use auto-generated "down" migrations. Follow
one of these approaches depending on the situation:

## If the migration has already been deployed

Write a new forward migration that reverses the change (e.g.
`026_revert_xyz.sql`) and run:

```bash
npm run migrate
```

## If the migration has NOT been deployed anywhere yet

1. Delete its row from `_migrations` and `_migration_checksums`.
2. Fix the SQL file.
3. Re-run:

```bash
npm run migrate
```

## Important

Never edit an already-applied migration file directly. The checksum
check in `migrate.js` will throw an error if the file content no
longer matches what was recorded when it was applied.

---

# Deployment Order

1. Run `npm run migrate` against the target database.
2. Deploy or restart the application instances.

---

# References

- `backend/src/db/migrate.js`
- `backend/migrations/`
- Operations Runbook — general deployment and rollback procedures
