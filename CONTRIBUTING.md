# Contributing to InternOps

Thank you for your interest in contributing to **InternOps**! This document walks you through everything you need to get your development environment running, write good code, run tests, and submit your changes for review.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Prerequisites](#prerequisites)
- [Development Environment Setup](#development-environment-setup)
  - [1. Fork & Clone](#1-fork--clone)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Running Tests Locally](#running-tests-locally)
  - [Prerequisites for Tests](#prerequisites-for-tests)
  - [Running the Test Suite](#running-the-test-suite)
  - [Coverage Report](#coverage-report)
- [Coding Standards & Conventions](#coding-standards--conventions)
  - [General Principles](#general-principles)
  - [Backend (Node.js / Fastify)](#backend-nodejs--fastify)
  - [Frontend (React / Vite)](#frontend-react--vite)
  - [Formatting & Linting](#formatting--linting)
- [Branch Naming](#branch-naming)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be respectful, inclusive, and constructive. Harassment or exclusionary behaviour of any kind will not be tolerated. By participating you agree to uphold these standards in all project spaces.

---

## Prerequisites

Make sure the following are installed on your machine before getting started:

| Tool           | Minimum Version        | Notes                                                              |
| -------------- | ---------------------- | ------------------------------------------------------------------ |
| **Node.js**    | v18+ (v22 recommended) | [nodejs.org](https://nodejs.org)                                   |
| **npm**        | v8+                    | Bundled with Node.js                                               |
| **PostgreSQL** | v14+                   | [postgresql.org](https://www.postgresql.org)                       |
| **Redis**      | —                      | Use [Upstash](https://upstash.com) (free tier) or a local instance |
| **Git**        | Any recent version     | —                                                                  |

> **Note:** The project uses [Upstash Redis](https://upstash.com) (REST-based), so no local Redis daemon is required for development. Create a free Upstash account and copy the REST URL and token into your `.env`.

---

## Development Environment Setup

### 1. Fork & Clone

1. Click **Fork** at the top-right of the repository page to create your own copy.
2. Clone your fork locally:

   ```bash
   git clone https://github.com/<your-username>/InternOps.git
   cd InternOps
   ```

3. Add the upstream remote so you can pull in future changes:

   ```bash
   git remote add upstream https://github.com/rajat-wyrm/InternOps.git
   ```

---

### 2. Backend Setup

```bash
cd backend
npm install
```

**Configure environment variables:**

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
NODE_ENV=development
PORT=5000

# PostgreSQL — local or cloud instance
DATABASE_URL=postgresql://user:password@localhost:5432/internops_dev

# JSON Web Tokens
JWT_SECRET=your-strong-random-secret
JWT_REFRESH_SECRET=your-strong-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Upstash Redis (get from https://upstash.com)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# CORS — must match the frontend dev server URL
CORS_ORIGIN=http://localhost:5173
APP_URL=http://localhost:5173

# Seed admin credentials
SEED_ADMIN_EMAIL=admin@internops.com
SEED_ADMIN_PASSWORD=Admin@123

# Optional AI keys (AI assistant features)
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
```

**Run database migrations and seed data:**

```bash
npm run migrate   # creates all tables
npm run seed      # inserts the default admin user
```

**Start the development server:**

```bash
npm run dev       # hot-reloads via node --watch
```

The API will be available at `http://localhost:5000`.  
Swagger docs are served at `http://localhost:5000/documentation`.

---

### 3. Frontend Setup

Open a new terminal, then:

```bash
cd frontend
npm install
```

**Configure environment variables:**

```bash
cp .env.example .env
```

Set the API base URL to match the backend server:

```env
VITE_API_BASE_URL=http://localhost:5000
```

**Start the Vite dev server:**

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Running Tests Locally

### Prerequisites for Tests

The test suite runs against a **dedicated PostgreSQL test database**. You need to create it before running tests for the first time:

```sql
-- In psql or your DB client
CREATE DATABASE internops_test;
```

The test environment reads credentials from `backend/.env.test`. This file is already committed with safe defaults for local use:

```env
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internops_test
JWT_SECRET=ci-test-secret-do-not-use-in-prod
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

Edit `backend/.env.test` if your local PostgreSQL user or password differs from the defaults above.

---

### Running the Test Suite

All test commands are run from the `backend/` directory:

```bash
cd backend

# Run all integration tests (includes migrate + seed automatically via globalSetup)
npm test

# Run a single test file
npm test -- tests/integration/auth.test.js

# Run in watch mode (re-runs on file changes)
npm test -- --watch
```

The Jest configuration (`jest.config.js`) runs tests **serially** (`--runInBand`) to avoid database race conditions. Do not remove this flag.

---

### Coverage Report

Coverage is collected automatically on every `npm test` run and written to `backend/coverage/`. To view the HTML report:

```bash
# After running npm test
open backend/coverage/lcov-report/index.html   # macOS/Linux
# Windows:
start backend/coverage/lcov-report/index.html
```

Coverage is collected from:

- `src/modules/auth/**`
- `src/modules/meetings/**`
- `src/middleware/**`
- `src/services/**`

When adding new features in these areas, please add or update the corresponding tests in `backend/tests/integration/`.

---

## Coding Standards & Conventions

### General Principles

- **Clarity over cleverness.** Code is read far more often than it is written.
- **One responsibility per module.** Routes, services, and repositories are separate concerns — keep them that way.
- **No secrets in source.** Never commit `.env` files, API keys, or credentials. Use `.env.example` for documentation.
- **Fail loudly.** Prefer explicit error throwing over silent failures.

---

### Backend (Node.js / Fastify)

- **Runtime**: Node.js with CommonJS modules (`require` / `module.exports`).
- **Framework**: Fastify v5 — use Fastify plugins, hooks, and decorators; avoid Express-style patterns.
- **Database**: Raw SQL with the `pg` client. No ORM. Queries live in `repository.js` files inside each module.
- **Validation**: All incoming request bodies and query parameters must be validated using **Zod** schemas.
- **Error handling**: Throw `Error` objects with descriptive messages; use Fastify's built-in error handler.
- **Logging**: Use the project's `src/logger.js` (Pino-based) — never use `console.log` in production paths.
- **Module structure**: Follow the established pattern for new feature modules:

  ```
  src/modules/<feature>/
  ├── routes.js       # Fastify route definitions + Zod schema
  ├── service.js      # Business logic
  └── repository.js   # SQL queries against the DB
  ```

---

### Frontend (React / Vite)

- **Framework**: React 18 with functional components and hooks.
- **Build tool**: Vite.
- **Styling**: Tailwind CSS utility classes — avoid inline `style` props.
- **Data fetching**: **TanStack Query** (`useQuery`, `useMutation`) for all server state. Do not use `useEffect` for data fetching.
- **HTTP client**: Use the pre-configured Axios instance from `src/lib/axios.js`. Do not create new Axios instances.
- **Component files**: One component per file, named with PascalCase (e.g., `CreateUserModal.jsx`).
- **Page files**: Placed under `src/pages/`, co-located by feature area (e.g., `src/pages/admin/`).

---

### Formatting & Linting

The project uses **Prettier** for formatting and **ESLint** for static analysis. Both must pass before a PR can be merged — they are enforced by the `format.yml` CI workflow.

**Run locally from the `backend/` directory:**

```bash
# Check for lint errors
npm run lint

# Auto-fix formatting
npm run format

# Validate DB-related conventions
npm run lint:db
```

**Prettier rules (`.prettierrc`):**

| Option          | Value    |
| --------------- | -------- |
| Print width     | 80       |
| Tab width       | 2 spaces |
| Semicolons      | Yes      |
| Quotes          | Single   |
| Trailing commas | ES5      |
| Arrow parens    | Always   |

Configure your editor to format on save using the `.prettierrc` in the repo root for a frictionless experience.

---

## Branch Naming

Create branches off of `master` using the following conventions:

| Type            | Pattern                        | Example                          |
| --------------- | ------------------------------ | -------------------------------- |
| New feature     | `feature/<short-description>`  | `feature/bulk-attendance-export` |
| Bug fix         | `fix/<short-description>`      | `fix/jwt-refresh-race-condition` |
| Documentation   | `docs/<short-description>`     | `docs/contributing-guide`        |
| Chore / tooling | `chore/<short-description>`    | `chore/update-dependencies`      |
| Refactor        | `refactor/<short-description>` | `refactor/auth-service-cleanup`  |

```bash
# Example
git checkout master
git pull upstream master
git checkout -b feature/my-new-feature
```

---

## Submitting a Pull Request

1. **Keep your branch up to date** with `master` before opening a PR:

   ```bash
   git fetch upstream
   git rebase upstream/master
   ```

2. **Self-review your diff.** Read every line of your changes as if you were the reviewer.

3. **Ensure all checks pass locally:**

   ```bash
   # Backend
   cd backend
   npm run lint
   npm run format
   npm test

   # Frontend
   cd frontend
   npm run build   # ensures no JSX compile errors
   ```

4. **Open a Pull Request** against the `master` branch on GitHub.

5. **Fill in the PR description** with:
   - A summary of _what_ changed and _why_.
   - Any relevant issue numbers (e.g., `Closes #42`).
   - Screenshots or recordings for UI changes.
   - Any migration steps required (e.g., new environment variables, DB migrations).

6. **Respond to review comments** promptly. Push fixup commits rather than force-pushing once a review has started — it preserves the review thread context.

7. **Do not merge your own PR.** At least one maintainer approval is required.

### PR Checklist

- [ ] Branch is up to date with `master`
- [ ] `npm run lint` passes (backend)
- [ ] `npm run format` has been run (backend)
- [ ] `npm test` passes with no regressions (backend)
- [ ] `npm run build` succeeds (frontend)
- [ ] New env variables are documented in `.env.example`
- [ ] New DB migrations are included if schema changed
- [ ] `CHANGELOG.md` updated under `[Unreleased]`

---

## Reporting Bugs

Before filing a bug report, please search [existing issues](../../issues) to check whether it has already been reported.

If it has not, open a **Bug Report** issue and include:

1. **Environment**: OS, Node.js version, browser (for frontend bugs).
2. **Steps to reproduce**: A minimal, numbered list of exactly what to do.
3. **Expected behaviour**: What you expected to happen.
4. **Actual behaviour**: What actually happened, including any error messages or stack traces.
5. **Logs**: Relevant server logs (strip any sensitive data before posting).

> **Security vulnerabilities** should **not** be disclosed publicly via GitHub Issues. Please contact a maintainer directly or use the private security reporting channel.

---

## Requesting Features

Open a **Feature Request** issue and describe:

1. **Problem statement**: What problem does this feature solve? Who is affected?
2. **Proposed solution**: A high-level description of what you have in mind.
3. **Alternatives considered**: Any other approaches you thought about and why you ruled them out.
4. **Additional context**: Mockups, references to similar implementations, or links to relevant documentation.

Feature requests are not guaranteed to be implemented, but all thoughtful proposals will be considered and discussed.

---

_Thank you for helping make InternOps better! 🚀_
