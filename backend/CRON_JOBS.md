# Scheduled Background Jobs (Cron)

## 1. Verified Proof Image Cleanup

**Job Name:** `proof-image-cleanup`  
**Source File:** `backend/src/utils/cron.js`

### Execution

- **Schedule:** `0 * * * *` (Runs hourly, at the top of the hour)
- **Timezone:** Server Local Time
- **Expected Runtime:** < 5 seconds (Depends on I/O speed and volume of files)

### Business Purpose

Interns upload image proofs for social tasks. Once a TL/Captain verifies the task, the image is no longer legally or operationally required. To prevent server storage exhaustion, this job automatically deletes the physical image files and clears the database paths 24 hours after verification.

### Operational Impact

- **Records Updated:** `proof_submissions` (sets `image_path` to `NULL` for processed rows)
- **File System:** Permanently deletes files from the local `uploads/` directory.
- **External APIs Used:** None.

### Permissions Required

- **Database:** `SELECT`, `UPDATE` permissions on the `proof_submissions` table.
- **File System:** `Read`, `Write`, `Delete` permissions for the Node process on the `uploads/` folder.

### Monitoring & Failure Behavior

- **Logs:** Outputs structured JSON logs to standard out (`info` on start/complete, `error` on failure) tracking `durationMs` and `filesDeleted`.
- **Failure Handling:** Fails gracefully. No automatic retry is configured because the job will naturally attempt to pick up missed rows on the next hourly run.
