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

### 1. Clone the Repository

```bash
git clone <repository-url>
cd InternOps
```

---

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

## 📌 About

This project was developed for efficient intern operations management.  
All rights reserved.
