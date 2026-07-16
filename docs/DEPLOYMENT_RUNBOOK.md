# InternOps Production Deployment & Rollback Runbook

This document outlines the automated CI/CD pipeline, manual deployment processes, and rollback strategies for the InternOps platform.

---

## 🚀 1. Continuous Deployment (CD) Pipeline

Our CD pipeline is configured via GitHub Actions in [.github/workflows/cd.yml](file:///.github/workflows/cd.yml).

### Automated CD Trigger
* On every merge or push to the `master` branch, the CD pipeline starts automatically.
* It logs into the **GitHub Container Registry (GHCR)**, builds the production-ready Docker image, and tags it as `latest` and with the current commit SHA.

### Manual CD Trigger (Single Action)
* Open the repository on GitHub.
* Navigate to **Actions** -> **InternOps CD**.
* Click the **Run workflow** dropdown and click **Run workflow** on the `master` branch.

---

## 🛠 2. Server Deployment Process

To deploy the latest built image on the target production server:

1. **SSH into the production server**:
   ```bash
   ssh deploy@production-server-ip
   ```
2. **Log into GitHub Container Registry** (using a personal access token):
   ```bash
   echo $GH_PAT | docker login ghcr.io -u <your-github-username> --password-stdin
   ```
3. **Pull and restart the container**:
   ```bash
   # Navigate to deployment directory
   cd /opt/internops

   # Pull the latest image
   docker compose pull backend

   # Apply migrations and restart services gracefully
   docker compose up -d --remove-orphans
   ```

---

## ⏪ 3. Rollback Procedure

If the production deployment is unstable or failing health checks, perform a rollback to a stable state:

### Option A: Quick Rollback to Previous Commit SHA Tag
If the failure is in the backend application code, roll back directly to the previous known stable commit tag:

1. **Locate the previous stable commit SHA** in the GitHub Actions history.
2. **Deploy the specific tag**:
   ```bash
   # SSH to the server and update your docker-compose.yml or env variable
   export BACKEND_TAG=sha-1a2b3c4d  # Replace with stable commit SHA
   docker compose pull backend
   docker compose up -d
   ```

### Option B: Local Rollback / Revert Commit
If you need to make changes to configuration or revert a PR:

1. **Revert the breaking PR** on GitHub or locally:
   ```bash
   git revert -m 1 <merge-commit-sha>
   git push origin master
   ```
2. The CD pipeline will automatically trigger, build the reverted code, and deploy the new `latest` tag.
