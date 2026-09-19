# [BUG/FEAT]: Profile Avatar Images Not Persisting Across Users & Deployed Environments (Local File System Storage)

## 📌 Issue Overview

Currently, user profile avatar uploads are stored directly on the local server filesystem inside the `backend/uploads/` directory. While this works in isolated single-user local testing, **profile avatar images fail to load and display as broken 404 images across different users, machines, and deployed server environments**.

---

## 🔍 Root Cause Analysis

1. **Local Server Storage (`backend/uploads/`)**:
   - In `backend/src/modules/uploads/routes.js`, avatar uploads are written via `fs.writeFileSync()` to local server disk under `config.uploadDir` (`backend/uploads`).
   - The PostgreSQL database only stores the relative path string `/uploads/avatar_<userId>_<hash>.<ext>`.

2. **Cross-User & Cross-Machine Failures**:
   - If **User A** uploads a profile picture on Machine A, the file only exists on Machine A's local disk.
   - When **User B** logs in on Machine B (or views User A's profile), User B's browser requests `http://localhost:5000/uploads/avatar_<userId>_<hash>.<ext>` from Machine B's backend, resulting in a **404 Not Found**.

3. **Deployed Server Ephemeral Filesystem**:
   - Hosting platforms such as Render, Railway, Heroku, or Koyeb use **ephemeral containers**.
   - Whenever the backend container restarts, redeploys, or goes to sleep, any local files uploaded to `backend/uploads/` are **permanently wiped**.
   - Multi-container load balancing routes user requests to containers that do not possess the uploaded file on their local disk.

---

## 🎯 Proposed Solutions & Technical Implementation

To resolve this issue permanently, avatar uploads should be migrated to a **Cloud Object Storage Provider** (or a dual Cloud/Local adapter).

### Solution 1: Cloudinary Integration (Recommended)

- **Why**: Free tier provides 25GB storage and 25k monthly transformations. Simple Node.js SDK, automatic image optimization, resizing, and CDN caching.
- **Workflow**:
  1. Backend receives image upload stream/buffer.
  2. Uploads buffer directly to Cloudinary using `cloudinary.uploader.upload_stream()`.
  3. Returns permanent secure HTTPS URL (`https://res.cloudinary.com/...`).
  4. Saves secure Cloudinary URL in PostgreSQL `users.avatar_url`.

### Solution 2: Firebase Storage / AWS S3 Bucket

- **Why**: Industry-standard object storage buckets.
- **Workflow**: Upload file buffer to bucket and store public HTTPS CDN URL in `users.avatar_url`.

### Solution 3: Environment Storage Driver Fallback

- `STORAGE_DRIVER=local` (for offline local development)
- `STORAGE_DRIVER=cloudinary` / `s3` (for production & staging environments)

---

## 📁 Key Files to Update

- **[backend/src/modules/uploads/routes.js](file:///c:/Users/Mugdha/Desktop/WebDev/Internship/UptoSkills/Internship_UptoSkill/backend/src/modules/uploads/routes.js)**: Update `/avatar` upload route handler to route files through the cloud storage service.
- **[backend/src/config/index.js](file:///c:/Users/Mugdha/Desktop/WebDev/Internship/UptoSkills/Internship_UptoSkill/backend/src/config/index.js)**: Add Cloudinary / S3 configuration keys (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
- **[frontend/src/lib/uploadUrl.js](file:///c:/Users/Mugdha/Desktop/WebDev/Internship/UptoSkills/Internship_UptoSkill/frontend/src/lib/uploadUrl.js)**: Ensure full `https://` URLs from cloud storage pass through cleanly without doubling origin prefixes.

---

## 🚀 Checklist

- [ ] Add cloud storage service adapter (`backend/src/services/storageService.js`)
- [ ] Support fallback to local `uploads/` when cloud credentials are not provided
- [ ] Test cross-user avatar visibility on deployed environments
