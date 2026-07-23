# InternOps

InternOps is an enterprise-grade workforce management platform designed to streamline intern operations, attendance tracking, and performance monitoring within structured team hierarchies.

---

## Features

- **Hierarchical RBAC**: 5-tier role system (Admin to Intern) with ownership validation.
- **Attendance**: Single/Bulk marking with audit trails.
- **Task Management**: Social task assignments with multi-level image proof verification.
- **Performance**: Immutable rating history and hierarchical analytics.
- **Security**: JWT auth, Argon2 hashing, CSRF protection, and rate limiting.
- **Audit Logging**: Immutable tracking of all sensitive actions.

---

## 🛠 Tech Stack

**Backend**

- Node.js
- Fastify
- PostgreSQL (Raw SQL)

**Frontend**

- React
- Vite
- Tailwind CSS
- TanStack Query

**Security**

- JWT
- Argon2
- Helmet
- Zod

---

## 📦 Prerequisites

- Node.js v18+
- PostgreSQL v14+
- npm

---

## ⚡ Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/rajat-wyrm/InternOps.git
cd InternOps
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in your credentials (see [Environment Variables](#environment-variables)), then run migrations and seed the database:

```bash
npm run migrate
npm run seed
npm run dev
```

### 3. Set up the frontend

In a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

Set `VITE_API_BASE_URL` in `.env`, then start the dev server:

```bash
npm run dev
```

### 4. Open the app

```
http://localhost:5173
```

---

## Environment Variables

| Variable           | Description                           | Example                                             |
| ------------------ | ------------------------------------- | --------------------------------------------------- |
| PORT               | Backend server port                   | 5001                                                |
| NODE_ENV           | Application environment               | development                                         |
| DATABASE_URL       | PostgreSQL database connection string | postgresql://user:password@localhost:5432/internops |
| JWT_SECRET         | Secret key for JWT access tokens      | your-jwt-secret                                     |
| JWT_REFRESH_SECRET | Secret key for JWT refresh tokens     | your-refresh-secret                                 |

### Complete Environment Variables

All backend environment variables are available in:

```text
backend/.env.example
```

The file is organized into the following sections:

- Core App Config
- Seed Admin Credentials
- Authentication
- Database (PostgreSQL)
- Google OAuth
- Fast2SMS
- AI Services
- Email (SMTP)
- Redis (Upstash)
- AI Cache
- AI Chat Daily Limit

Copy `backend/.env.example` to `.env` and replace the example values with your own credentials before starting the application.

### 2. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in your DB credentials and secrets
npm run migrate
npm run seed
npm run dev
```

---

### 3. Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Fill in your VITE_API_BASE_URL
npm run dev
```

---

## 🌐 Access the Application

Open your browser and go to:

```
http://localhost:5173
```

---

## 📁 Project Structure

```plaintext
InternOps/
├── backend/       # Fastify REST API, Services, Repositories
├── frontend/      # React + Vite web application
```

---

## Available npm Scripts

### Backend (`cd backend`)

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the backend development server |
| `npm run migrate` | Run database migrations              |
| `npm run seed`    | Seed the database with initial data  |

### Frontend (`cd frontend`)

| Command           | Description                       |
| ----------------- | --------------------------------- |
| `npm run dev`     | Start the Vite development server |
| `npm run build`   | Build the production application  |
| `npm run preview` | Preview the production build      |

---

## Troubleshooting

### Backend does not start

- Make sure all required environment variables are configured in `backend/.env`.
- Run `npm install` to install all dependencies.
- Verify that the configured port is not already in use.

### Frontend cannot connect to backend

- Ensure the backend server is running.
- Verify the API base URL in `frontend/.env`.
- Confirm the backend and frontend ports match the README instructions.

### Database connection issues

- Verify the `DATABASE_URL` is correct.
- Ensure PostgreSQL is running.
- Run database migrations before starting the application.

### Login issues

- Run the seed command to create the default admin account.
- Check that the backend server is running successfully.
- Verify the credentials configured in the environment variables.

---

## 📌 About

This project was developed for efficient intern operations management.  
All rights reserved.
---

## Security

Please refer to [SECURITY.md](SECURITY.md) for information about reporting security vulnerabilities.

👉 View our history of updates in the **[CHANGELOG.md](CHANGELOG.md)**.
