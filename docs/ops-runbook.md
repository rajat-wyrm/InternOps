# Operations Runbook

## Purpose

This runbook provides operational guidance for deploying, monitoring, maintaining, and recovering the InternOps platform. It is intended for developers and operators responsible for deploying and supporting the application in development, staging, and production environments.

---

# System Overview

InternOps is an enterprise-grade workforce management platform designed to streamline intern operations, attendance tracking, task management, and performance monitoring.

## Architecture

| Component        | Technology              |
| ---------------- | ----------------------- |
| Frontend         | React + Vite            |
| Backend          | Node.js + Fastify       |
| Database         | PostgreSQL 14           |
| Authentication   | JWT                     |
| Monitoring       | Prometheus + Grafana    |
| Containerization | Docker & Docker Compose |

---

# Prerequisites

Before deploying the application, ensure the following requirements are met:

- Docker
- Docker Compose
- Git
- Backend environment variables configured
- PostgreSQL database credentials
- Required application secrets

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Update all required environment variables before deployment.

Important variables include:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

---

# Deployment Procedure

## Recommended Deployment

InternOps includes a production startup script that automates deployment.

Run:

```powershell
.\start-production.ps1
```

The script performs the following tasks:

1. Builds Docker images.
2. Starts all required services.
3. Waits for PostgreSQL to become healthy.
4. Runs database migrations.
5. Seeds the initial administrator account.
6. Displays running service information.

---

## Manual Deployment

### 1. Pull the latest source code

```bash
git pull origin master
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Update the environment file with the appropriate credentials.

### 3. Build Docker images

```bash
docker-compose build
```

### 4. Start the services

```bash
docker-compose up -d
```

### 5. Verify PostgreSQL health

```bash
docker-compose ps
```

### 6. Run database migrations

```bash
docker-compose exec backend npm run migrate
```

### 7. Seed the database

```bash
docker-compose exec backend npm run seed
```

### 8. Verify deployment

Backend

```
http://localhost:5000
```

Swagger Documentation

```
http://localhost:5000/docs
```

PostgreSQL

```
localhost:5432
```

---

# Rollback Procedure

If a deployment fails or introduces unexpected issues:

1. Stop the running services.

```bash
docker-compose down
```

2. Switch to the previous stable release.

```bash
git checkout <previous-tag-or-commit>
```

3. Rebuild the Docker images.

```bash
docker-compose build
```

4. Restart the services.

```bash
docker-compose up -d
```

5. Verify application health before restoring production traffic.

---

# Database Backup

Create a backup using PostgreSQL's `pg_dump`.

Replace `<postgres-container>` with the name of the running PostgreSQL container. The container name can be obtained by running Docker container listing commands on the deployment environment.

Example:

```bash
docker exec -t <postgres-container> pg_dump -U internops internops > backup.sql
```

Recommended practices:

- Perform regular automated backups.
- Store backups securely.
- Verify backup integrity periodically.
- Retain backups according to organizational policy.

---

# Database Restore

Restore the database from a previously created backup.

Replace `<postgres-container>` with the name of the running PostgreSQL container.

Example:

```bash
cat backup.sql | docker exec -i <postgres-container> psql -U internops internops
```

After restoration:

- Verify database tables.
- Run any required migrations.
- Restart backend services.
- Confirm application health.

---

# Monitoring

InternOps provides monitoring support using Prometheus and Grafana.

| Service    | Default Port |
| ---------- | -----------: |
| Prometheus |         9090 |
| Grafana    |         3000 |

Start the monitoring stack:

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

Check running services:

```bash
docker-compose ps
```

View backend logs:

```bash
docker-compose logs backend
```

View PostgreSQL logs:

```bash
docker-compose logs postgres
```

---

# Health Checks

The application exposes health endpoints to verify system status.

## Application Health

```
GET /health
```

Verifies that the backend application is running.

---

## Database Health

```
GET /health/db
```

Checks database connectivity.

---

## Full System Health

```
GET /health/full
```

Performs a comprehensive health check for dependent services.

---

## AI Provider Health

The AI module provides a dedicated health endpoint to verify configured AI provider availability.

---

# Common Incident Response

## Backend fails to start

### Possible causes

- Missing environment variables
- Invalid configuration
- Port already in use

### Resolution

- Verify the backend `.env` configuration.
- Review backend logs.
- Ensure port **5000** is available.

---

## Database connection failure

### Possible causes

- PostgreSQL service unavailable
- Incorrect `DATABASE_URL`
- Network connectivity problems

### Resolution

- Verify PostgreSQL container status.
- Confirm `DATABASE_URL` configuration.
- Restart the database service if necessary.

---

## Migration failure

### Resolution

Review migration logs and rerun migrations:

```bash
docker-compose exec backend npm run migrate
```

---

## Authentication issues

### Possible causes

- Invalid JWT secrets
- Expired authentication tokens

### Resolution

- Verify JWT configuration.
- Restart backend services after updating secrets.

---

## Monitoring services unavailable

### Resolution

- Verify Prometheus and Grafana containers are running.
- Restart the monitoring stack if required.
- Review monitoring container logs.

---

## High resource utilization

### Resolution

- Review application logs.
- Check database performance.
- Restart affected containers if necessary.
- Investigate long-running processes.

---

# Operational Checklist

After every deployment, verify the following:

- Backend container is running.
- PostgreSQL container reports a healthy status.
- Database migrations completed successfully.
- Initial seed completed successfully.
- Monitoring services are running.
- `/health` responds successfully.
- `/health/db` responds successfully.
- `/health/full` responds successfully.
- Swagger documentation is accessible.
- Application login functions correctly.

---

# Useful Commands

Check running containers:

```bash
docker-compose ps
```

View backend logs:

```bash
docker-compose logs backend
```

View PostgreSQL logs:

```bash
docker-compose logs postgres
```

Restart services:

```bash
docker-compose restart
```

Stop services:

```bash
docker-compose down
```

---

# References

- `README.md`
- `docker-compose.yml`
- `docker-compose.monitoring.yml`
- `Dockerfile`
- `start-production.ps1`
- `backend/.env.example`
