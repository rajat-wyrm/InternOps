# Migration Numbering Conflict Fix

## Problem Identified

The deployment-parity GitHub Actions check was failing because of a **duplicate migration file prefix**:

- `036_add_internship_domain_to_users.sql` (our new CSV export migration)
- `036_create_assessments.sql` (existing migration from upstream)

The validation script in `.github/workflows/deployment-parity.yml` checks:

```javascript
const prefix = file.slice(0, 3); // Gets "036"
if (seen.has(prefix)) {
  throw new Error(
    `Duplicate migration prefix ${prefix}: ${seen.get(prefix)} and ${file}`
  );
}
```

This caused the Deployment Parity check to fail with: **Duplicate migration prefix 036**

## Solution Implemented

### 1. ✅ Renamed Migration File

- Old: `backend/migrations/036_add_internship_domain_to_users.sql`
- New: `backend/migrations/055_add_internship_domain_to_users.sql`
- Rationale: `054_hierarchy_recursive_cte_indexes.sql` was the last migration, so 055 was the next available number

### 2. ✅ Updated Documentation Files

Updated all references to the old migration filename in:

- `CSV_EXPORT_FIX_SUMMARY.md` (2 references)
- `PR_2069_FIX_GUIDE.md` (3 references)
- `pull_request_description.md` (1 reference)

### 3. ✅ Committed Changes

```bash
commit fa8ecbf
fix: rename migration 036 to 055 to avoid numbering conflict
```

### 4. ✅ Pushed to Remote

Successfully pushed to `origin/fix/team-csv-fields-2021`

## Migration Sequence Verification

The migrations now follow the correct sequence:

```
053_social_tasks_department.sql
054_hierarchy_recursive_cte_indexes.sql
055_add_internship_domain_to_users.sql ✅ (NEW - unique prefix)
```

## Expected CI/CD Results

With this fix:

- ✅ **Deployment Parity Check** should now PASS (migration validation fixed)
- ✅ **Test Suite** should now run (tests were already set up correctly in CI)
- ✅ **Render Parity** should confirm the app health endpoint works

## Git History

```
fa8ecbf (HEAD -> fix/team-csv-fields-2021) fix: rename migration 036 to 055 to avoid numbering conflict
acb1236 merge: resolve conflicts with upstream/master - keep CSV export fixes
db6d369 docs: Add PR #2069 description fix guide
0b5ae6d docs: Add comprehensive PR description for CSV export fix
262c598 (upstream/master) Merge pull request #2016 from ...
```

## Files Changed in This Fix

- ✅ `backend/migrations/055_add_internship_domain_to_users.sql` (renamed from 036)
- ✅ `CSV_EXPORT_FIX_SUMMARY.md` (updated references)
- ✅ `PR_2069_FIX_GUIDE.md` (updated references)
- ✅ `pull_request_description.md` (updated references)

## Next Steps

The GitHub Actions checks on the PR should now:

1. Pass the "Deployment Parity / Render parity" check
2. Pass the "InternOps CI / test" check (backend tests)
3. All status checks should be ✅ GREEN

All code changes remain unchanged - only the migration file numbering was corrected to comply with the validation requirements.
