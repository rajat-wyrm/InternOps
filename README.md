# InternOps

Enterprise Workforce Management and Intern Operations Platform

[![License](https://img.shields.io/badge/License-Proprietary-blue?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.x-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)

## Table of Contents

- Executive Summary
- Key Features
- System Architecture
- Technology Stack
- Design Principles
- Backend Architecture
- Frontend Architecture
- Authentication Flow
- Authorization Model
- Hierarchy Model
- Database Design
- Database Schema Tables
- Security Architecture
- API Overview
- Major Modules
- Reports and Analytics
- Session Management
- Audit Logging
- Notifications
- Deployment Architecture
- Environment Variables
- Installation
- Quick Start
- Database Migration
- Seed Data
- Running Backend
- Running Frontend
- Testing
- API Documentation
- Performance Considerations
- Scalability Considerations
- Future Integrations
- Production Checklist
- Troubleshooting
- Contributing
- License
- Maintainer

## Executive Summary

InternOps is a production-grade workforce management platform designed to streamline intern operations within structured hierarchies. It provides a full suite of tools for attendance tracking, performance ratings, social task assignments, proof verification, team meetings, notifications, and comprehensive audit logging. The system enforces strict role-based access control with ownership validation, ensuring data integrity and security across all levels of the organization.

Built with a modern Node.js/Fastify backend and a React/Vite frontend, InternOps follows enterprise design patterns such as repository abstraction, middleware-based authorization, and raw SQL queries for optimal database performance. The platform is ready for integration with the Uptoskills ecosystem, with dedicated placeholder modules for future synchronization.

## Key Features

- **Five-tier role hierarchy** - Admin, Senior TL, TL, Captain, Intern with rigid access controls.
- **Attendance management** - Single and bulk attendance marking with monthly statistics and audit trails.
- **Ratings system** - Permanent, immutable rating history with hierarchical rating permissions.
- **Social task management** - Task creation, screenshot proof uploads, and multi-level verification with auto-cleanup of files after 24 hours.
- **Meeting scheduling** - Team meetings with attendee management and hierarchy-aware visibility.
- **Notifications** - Real-time in-app notifications with pagination and read/unread tracking.
- **Reports and analytics** - Attendance summaries, rating trends, task completion stats, CSV exports.
- **Session management** - View active sessions, revoke individual or all user sessions (admin).
- **Audit logging** - Immutable log of every sensitive action (login, attendance, rating, user changes).
- **Security** - JWT authentication, refresh token rotation, Argon2 hashing, CSRF, rate limiting, input sanitization, Helmet headers.
- **RBAC + Ownership validation** - Every API request is validated for both role and hierarchical access.
- **Database** - PostgreSQL with raw SQL (no ORM), UUIDs, foreign keys, indexes, soft deletes.
- **Future integration** - Uptoskills placeholder modules ready for syncing users, attendance, projects.

## System Architecture

InternOps follows a monolithic backend with a separate React frontend, communicating via REST APIs. The backend is built on Fastify and uses raw SQL queries through the `pg` driver. Redis is optionally used for refresh token storage and can be enabled for production scaling.

The architecture emphasizes:

- Clear separation of concerns (routes, services, repositories, middleware)
- Centralized error handling and request logging
- Idempotent database migrations
- BOM-free source files for reliable cross-platform execution

## Technology Stack

| Component       | Technology                         |
| --------------- | ---------------------------------- |
| Backend runtime | Node.js (>=18)                     |
| Framework       | Fastify v4                         |
| Frontend        | React 18, Vite, TailwindCSS, Axios |
| Database        | PostgreSQL (via `pg` driver)       |
| Authentication  | JWT, Argon2                        |
| Caching         | Redis (optional)                   |
| Documentation   | Swagger (OpenAPI)                  |
| Security        | Helmet, CORS, CSRF, Rate Limiting  |
| Validation      | Zod                                |
| Logging         | Pino                               |
| DevOps          | Git, GitHub, PowerShell scripts    |

## Design Principles

- **Security First** - Every endpoint is guarded with authentication, RBAC, and ownership checks.
- **Raw SQL over ORM** - Maximum performance and control with handwritten parameterized queries.
- **Immutability** - Attendance and ratings are never overwritten; changes generate new records or audit logs.
- **Idempotency** - Migration and seed scripts can be safely re-executed.
- **Separation of Concerns** - Routes -> Service -> Repository pattern with clear boundaries.
- **Environment-based Configuration** - All secrets and URLs loaded from `.env`.

## Backend Architecture

The backend follows a modular monolith pattern. Each business module (auth, users, attendance, etc.) is self-contained with its own routes, repository, and optional service layer. Middleware is composed globally or per-route.

- Routes - Define Fastify endpoints, validate input with Zod, delegate to services/repositories.
- Repository - Encapsulates all database queries; no raw SQL in routes.
- Middleware - Auth, RBAC, ownership, CSRF, brute force, and input sanitization.
- Database - PostgreSQL accessed via `pg` with connection pooling and statement timeout.

## Frontend Architecture

The frontend is a React SPA with Vite as build tool and TailwindCSS for styling. State management is handled by Zustand, server state by TanStack Query, and HTTP requests by Axios with automatic token refresh.

- **Protected routes** - Implemented via a PrivateRoute component checking JWT presence.
- **API layer** - Axios instance with interceptors for auth headers and token refresh.
- **UI components** - Built with Shadcn UI primitives, Tailwind utility classes.

## Authentication Flow

1. Client sends `POST /api/auth/login` with email and password.
2. Server verifies Argon2 hash, generates 15-minute access token and 7-day refresh token.
3. Refresh token is hashed and stored in `refresh_tokens` table.
4. Access token is returned in response body; refresh token in HTTP-only cookie.
5. Client stores access token in memory and attaches it via `Authorization` header.
6. On 401, client calls `POST /api/auth/refresh` with the refresh token to obtain a new pair.
7. Old refresh token is revoked server-side.

## Authorization Model

Two layers of authorization are enforced on every protected route:

1. **Role-Based Access Control (RBAC)** - Middleware checks user.role against a list of allowed roles.
2. **Ownership Validation** - Additional middleware ensures the requesting user is in the hierarchy chain of the target resource (e.g., a TL cannot access interns not in their team).

## Hierarchy Model

- Admin - Full access to all resources and users.
- Senior TL - Manages TLs, Captains, and Interns within assigned departments.
- TL - Manages Captains and Interns.
- Captain - Manages Interns directly.
- Intern - Can view own data, upload proof submissions.

Ownership is validated recursively using a `WITH RECURSIVE` cte that walks the manager chain.

## Database Design

- All tables use UUID primary keys.
- Soft deletes implemented via `deleted_at` timestamp column.
- Audit logs store old/new values as JSON.
- Indexes on foreign keys, email, role, and date columns for performance.
- Transactions used for multi-statement operations (migrations, bulk attendance).

## Database Schema Tables

| Table                   | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `users`                 | All platform users with role, manager, department |
| `departments`           | Organizational departments                        |
| `attendance`            | Daily attendance records (user, date, status)     |
| `ratings`               | Performance ratings with score and remarks        |
| `social_tasks`          | Tasks created by Admin/Senior TL                  |
| `proof_submissions`     | Image proofs submitted by interns                 |
| `notifications`         | In-app notifications per user                     |
| `meetings`              | Scheduled meetings                                |
| `meeting_attendees`     | Junction table for meeting participants           |
| `audit_logs`            | Immutable audit trail for sensitive actions       |
| `refresh_tokens`        | Hashed refresh tokens for session management      |
| `password_reset_tokens` | Time-limited password reset tokens                |
| `login_attempts`        | Failed/successful login tracking (brute force)    |

## Security Architecture

- Jwt with 15-minute access token and 7-day refresh token rotation.
- Argon2id for password hashing with high memory cost.
- Rate limiting per IP and per route (100 req/min general, 5 req/min for auth).
- CSRF protection via `X-CSRF-Token` header required for mutating requests.
- Helmet for secure HTTP headers.
- CORS configured to allow only trusted origins in production.
- Input sanitization strips HTML tags and single/double quotes from request body/query/params.
- Brute force protection - Temporary account lockout after 5 failed login attempts in 15 minutes.
- Soft deletes - Data is never physically removed; `deleted_at` marks records as inactive.
- Audit logging - Every sensitive action is recorded with user ID, IP, user-agent, old/new values.
- Session revocation - Users can revoke individual or all sessions; admins can revoke any user's sessions.

## API Overview

All API endpoints are prefixed with `/api`. Interactive documentation is available at `/docs` when the server is running.

| Module        | Endpoint Prefix      | Description                                                       |
| ------------- | -------------------- | ----------------------------------------------------------------- |
| Auth          | `/api/auth`          | Login, register, refresh, logout, password reset, CSRF token      |
| Users         | `/api/users`         | CRUD operations, profile, password change                         |
| Departments   | `/api/departments`   | Create and list departments                                       |
| Hierarchy     | `/api/hierarchy`     | Direct reports, full team, upward chain                           |
| Attendance    | `/api/attendance`    | Mark, bulk mark, view, monthly stats                              |
| Ratings       | `/api/ratings`       | Submit rating, view rating history                                |
| Tasks         | `/api/tasks`         | Create and list social tasks                                      |
| Proofs        | `/api/proofs`        | Submit proof (intern), verify (captain+)                          |
| Notifications | `/api/notifications` | List, mark read, delete, mark all read                            |
| Audit         | `/api/audit`         | View audit logs (admin only)                                      |
| Uploads       | `/api/uploads`       | Avatar upload                                                     |
| Analytics     | `/api/analytics`     | Overview, department attendance, top performers, trends           |
| Meetings      | `/api/meetings`      | CRUD, attendees management                                        |
| Sessions      | `/api/sessions`      | List own sessions, revoke, admin revoke                           |
| Reports       | `/api/reports`       | Attendance summary, ratings summary, task completion, CSV exports |
| Uptoskills    | `/api/uptoskills`    | Sync status placeholder                                           |

## Major Modules

- Attendance - Supports single and bulk marking with remarks. Records are immutable; updates create a new record and log the change.
- Ratings - Each rating is stored as a new row; historical queries show all past ratings. Rating is permitted only by direct manager according to the hierarchy step.
- Social Tasks - Admins/Senior TLs create tasks with a deadline. Interns upload image proofs. Captains/TLs/Senior TLs verify. Verified images are automatically deleted after 24 hours via a cron job.
- Meetings - Scheduling with date, time, attendees. Visibility is restricted to creator, attendees, or managers within the hierarchy.
- Notifications - Sent automatically on attendance marking, ratings, task creation. Users can view paginated list, mark as read, or delete.

## Reports and Analytics

- Attendance Summary - Aggregated counts by role and status for a date range.
- Rating Summary - Average score and total ratings per role for a date range.
- Task Completion - Verified vs pending counts per task.
- Top Performers - Interns ranked by average rating.
- Attendance Trends - Monthly attendance distribution for the past N months.
- Exports - CSV download links for attendance, ratings, and task data.

## Session Management

- Users can view all active sessions (from `refresh_tokens` table).
- Individual sessions can be revoked (token marked as revoked).
- "Revoke all" logs out all devices except the current one.
- Admin endpoint to force-revoke all sessions for any user.

## Audit Logging

Every sensitive action is logged with:

- Actor (user ID)
- Action (e.g., `USER_CREATED`, `ATTENDANCE_MARKED`)
- Resource type and ID
- Old and new values (JSON)
- IP address and user agent
- Timestamp

## Notifications

Stored in the `notifications` table with a `read` boolean. Polled or fetched by the frontend. Endpoints support pagination, marking single or all as read, and deletion.

## Deployment Architecture

Recommended production setup:

- Backend - Node.js cluster with PM2, behind Nginx reverse proxy.
- Frontend - Static build served via Nginx or CDN�
- Database - Managed PostgreSQL (e.g., AWS RDS, Neon).
- Redis - Upstash or self-hosted for optional token storage.
- Environment - All secrets injected via environment variables.
- HTTPS - Terminate TLS at Nginx level.

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values. The following variables are used:

| Variable                   | Description                           |
| -------------------------- | ------------------------------------- |
| `NODE_ENV`                 | `development` or `production`         |
| `PORT`                     | Server port (default 5000)            |
| `DATABASE_URL`             | PostgreSQL connection string          |
| `JWT_SECRET`               | Secret key for JWT signing            |
| `UPSTASH_REDIS_REST_URL`   | Redis connection URL (optional)       |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token (optional)                |
| `CORS_ORIGIN`              | Allowed origin for CORS in production |
| `EMAIL_API_KEY`            | Email service API key (optional)      |
| `UPTOSKILLS_BASE_URL`      | Uptoskills API base URL (future)      |
| `UPTOSKILLS_API_KEY`       | Uptoskills API key (future)           |

## Installation

```bash
git clone https://github.com/rajat-wyrm/InternOps.git
cd InternOps
cd backend && npm install
cd ../frontend && npm install
```

## Quick Start

1. Configure environment variables in `backend/.env`.
2. Run database migrations:
   ```bash
   cd backend
   npm run migrate
   ```
3. Seed the admin user:
   ```bash
   npm run seed
   ```
4. Start backend:
   ```bash
   npm run dev
   ```
5. Start frontend (optional):
   ```bash
   cd frontend
   npm run dev
   ```
6. Open `http://localhost:5000/docs` for Swagger UI.

## Database Migration

Migrations are idempotent and tracked in the `_migrations` table. Run:

```bash
npm run migrate
```

The migration runner skips already-applied files and handles BOM encoding.

## Seed Data

The seed script creates a default admin user (`admin@internops.com` / `Admin@123`). It is safe to run multiple times.

## Running Backend

Development (with auto-reload via `node --watch`):

```bash
npm run dev
```

Production:

```bash
NODE_ENV=production npm start
```

## Running Frontend

Development (Vite dev server with API proxy):

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Testing

The repository includes PowerShell-based integration test scripts that verify every API endpoint with proper authentication and CSRF tokens. Run from the project root:

```powershell
. \scripts\full-test.ps1
```

Unit and integration tests (to be added) will use a dedicated test framework.

## API Documentation

Interactive Swagger UI is available at `/docs` when the backend is running. The OpenAPI spec is auto-generated from Fastify route schemas.

## Performance Considerations

- Connection pooling with `pg` (max 20 connections).
- Statement timeout of 10 seconds to prevent long-running queries from blocking the pool.
- Indexes on frequently queried columns (email, role, manager_id, date).
- Bulk attendance endpoint uses a single transaction for multiple inserts.
- Redis (optional) reduces database load for session lookups.

## Scalability Considerations

- Backend is stateless; can be horizontally scaled behind a load balancer.
- Database connection pooling limits concurrency; read replicas can be added for heavy reporting.
- File uploads are stored locally; for multi-server deployments, migrate to object storage (S3).
- Redis can be integrated for session and CSRF token storage.

## Future Integrations

The `modules/uptoskills` folder contains placeholder services for syncing users, departments, attendance, and projects with the Uptoskills ecosystem. Environment variables are already wired; developers need to implement the actual API calls.

## Production Checklist

- [] Set `NODE_ENV=production`
- [] Generate strong `JWT_SECRET`
- [] Configure `CORS_ORIGIN` to your frontend domain
- [] Use managed PostgreSQL with SSL
- [] Enable Redis for refresh token storage
- [] Set up PM2 or similar process manager
- [] Configure Nginx reverse proxy with HTTPS
  [ ] Set up monitoring and alerting

## Troubleshooting

| Issue                                         | Solution                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Server fails with `Plugin must be a function` | Ensure all `app.register()` calls receive a function, not an object. CSRF middleware should use `app.addHook('onRequest', csrfProtection)`. |
| Endpoints timeout or hang                     | Verify `DATABASE_URL` includes `uselibpqcompat=true` if using Neon. Check statement_timeout setting in pool.                                |
| Migrations fail with BOM error                | The migration runner strips BOM automatically. Regenerate the SQL file with `[System.IO.File]::WriteAllText(...)`.                          |
| Redis connection errors in logs               | Set `UPSTASH_REDIS_REST_URL` to empty if Redis is not used.                                                                                 |
| Swagger UI blank page                         | Ensure rate limit is not too restrictive on `/docs/static/*`.                                                                               |

## Contributing

Contributions are currently not accepted for external collaborators. For internal development, follow the existing code style, add JSDoc comments, and ensure all endpoint tests pass before committing.

## License

Proprietary. All rights reserved.

## Maintainer

**Rajat Kumar - Project Management**

[GitHub](https://github.com/rajat-wyrm)
