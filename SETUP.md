# Rebound ERP - Local Development & Setup Guide

## 1. Production Data & Supabase Safety Assessment

> [!WARNING]
> **PREVIOUS RISK:** In the original repository state, `backend/.env` was directly configured with the **production Supabase PostgreSQL connection strings** (`aws-1-ap-south-1.pooler.supabase.com`). Running backend dev servers, seed scripts, or Prisma commands (`prisma db push`, `prisma migrate reset`, `clear_db.js`) in that state **would have directly modified and deleted data in your live Supabase production database!**

### Actions Taken to Protect Production Data:
1. **Production Credentials Backed Up:** The production Supabase credentials were moved safely to [`backend/.env.production`](file:///c:/Users/cjain/Universe/Rebound/backend/.env.production).
2. **Local Isolation Configured:** [`backend/.env`](file:///c:/Users/cjain/Universe/Rebound/backend/.env) and [`backend/.env.local`](file:///c:/Users/cjain/Universe/Rebound/backend/.env.local) now point strictly to the local PostgreSQL database:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rebound_local"
   DIRECT_URL="postgresql://postgres:postgres@localhost:5432/rebound_local"
   ```
3. **Zero Impact on Production:** All local operations, tests, order placements, visits, and migrations now run **100% locally** against `rebound_local`. Production Supabase will **never** be touched or modified during local development.

---

## 2. Installed Environment & Dependencies

All required tools and dependencies have been installed on your system:

| Component | Status | Details |
| :--- | :--- | :--- |
| **Node.js** | Installed | `v20.18.0` LTS in `%LOCALAPPDATA%\Programs\nodejs` |
| **npm** | Installed | `10.8.2` |
| **Git** | Installed | `2.55.0` in `C:\Program Files\Git` |
| **PostgreSQL** | Installed & Initialized | PostgreSQL 16.3 portable engine in `%LOCALAPPDATA%\Programs\pgsql` |
| **Local Database** | Created & Seeded | `rebound_local` database created on `localhost:5432` |
| **Backend Dependencies** | Installed | Express, Prisma ORM, WebSockets, TypeScript, etc. |
| **Frontend Dependencies** | Installed | Next.js 13, React 18, TailwindCSS, Lucide, SWR, etc. |
| **Prisma Schema** | Synced | Tables, indexes, and relations pushed to `rebound_local` |
| **Seed Data** | Populated | Staff members, Pool & Snooker tables, and 21 Menu catalog items |

---

## 3. How to Run the Project Locally

### Step 1: Ensure Local PostgreSQL is Running
You can start or verify the local PostgreSQL database with:
```powershell
npm run db:start
```
*(Or double-click `scripts\start-db.bat`)*

To stop the database when you are done:
```powershell
npm run db:stop
```

---

### Step 2: Start the Backend Server (Terminal 1)
```powershell
npm run dev:backend
```
- **Backend URL:** `http://localhost:3001`
- **Health Check:** `http://localhost:3001/health`
- **WebSocket URL:** `ws://localhost:3001`

---

### Step 3: Start the Frontend Application (Terminal 2)
```powershell
npm run dev:frontend
```
- **Frontend URL:** `http://localhost:3000`

---

## 4. Default Seeded Login Credentials

The local database comes pre-seeded with the following staff accounts:

| Username | Password | Role |
| :--- | :--- | :--- |
| `chirag` | `rebound@123` | Owner |
| `ajinkya` | `rebound@123` | Owner |
| `ayush` | `rebound@123` | Owner |

---

## 5. Useful Project Commands

From the root project directory:
- `npm run db:start` — Starts the local PostgreSQL server.
- `npm run db:stop` — Stops the local PostgreSQL server.
- `npm run db:push` — Syncs any Prisma schema changes to `rebound_local`.
- `npm run db:seed` — Reseeds staff, tables, and menu catalog.
- `npm run dev:backend` — Starts the Express TypeScript backend in watch mode.
- `npm run dev:frontend` — Starts Next.js development server.
