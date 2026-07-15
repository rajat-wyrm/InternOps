# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this project adheres to [Semantic Versioning](https://semver.org).

## [Unreleased]

### Added

- API versioning infrastructure: all business routes are now namespaced under `/api/v1/` (`app.js`).
- `src/routes.v2.js` skeleton for future breaking changes — registered at `/api/v2/` alongside the stable v1 router.
- `Deprecation`, `Sunset`, and `Link` response headers on all v1 routes when `V1_DEPRECATED=true` env var is set (`src/routes.js`).
- Swagger `servers` block now lists both `/api/v1` and `/api/v2` entries.
- Three API versioning env vars documented in `backend/.env.example` (`V1_DEPRECATED`, `V1_DEPRECATION_DATE`, `V1_SUNSET_DATE`).
- API Versioning Policy section in `CONTRIBUTING.md` (90-day sunset window, deprecation header format, v2 introduction guide).

## [v1.0.1] - 2026-07-09

### Changed

- Configured production deployment files (`start-production.ps1`, `stop-production.ps1`).
- Cleaned up root-level database testing scripts (`_dbtest.js`).

## [v1.0.0] - 2026-06-15

### Added

- Enterprise-grade workforce management system core files.
- Hierarchical Role-Based Access Control (RBAC) with 5-tier role validation.
- Single and bulk attendance logging trails.
- Multi-level image proof verification for task management.
- Fastify REST API backend setup with raw PostgreSQL queries.
- React frontend layout integrated with Vite and Tailwind CSS.
