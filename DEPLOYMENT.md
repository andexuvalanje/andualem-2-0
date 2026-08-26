# ANDUALEM 2.0 — Cloudflare Workers & Cloudflare D1 Deployment Guide

This guide details how to develop locally and deploy **ANDUALEM 2.0 V2** to **Cloudflare Workers** with **Cloudflare D1** database persistence.

---

## 🏗️ Architecture Overview

```
Browser (UI)
   │
   ├──▶ Local Express Server (node server.js)  ➔  Local SQLite (./data/andualem.db)
   │
   └──▶ Cloudflare Workers (src/worker.js)     ➔  Cloudflare D1 Database (binding: DB)
```

- **Frontend**: Static Cybertronic Glassmorphic SPA served from `./public`.
- **Production Backend**: Cloudflare Worker script ([`src/worker.js`](file:///d:/blender/C/ANDUALEM%202.0/src/worker.js)) handling REST API endpoints.
- **Production Database**: Cloudflare D1 Serverless SQL Database (`binding: DB`).
- **Migrations**: Reproducible SQL schema ([`migrations/0001_initial_schema.sql`](file:///d:/blender/C/ANDUALEM%202.0/migrations/0001_initial_schema.sql)).

---

## 💻 1. Local Development (Wrangler & Local D1 Sandbox)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Apply Migrations to Local D1 Sandbox
```bash
npx wrangler d1 migrations apply DB --local
```

### Step 3: Start Local Wrangler Dev Server
```bash
npx wrangler dev
```
Open your browser at `http://localhost:8787` to access the application running against the local Cloudflare Worker & D1 sandbox.

---

## ☁️ 2. Cloudflare Production Deployment

### Step 1: Authenticate with Cloudflare
```bash
npx wrangler login
```

### Step 2: Create Cloudflare D1 Production Database
```bash
npx wrangler d1 create andualem-db
```
*Copy the `database_id` output from Wrangler.*

### Step 3: Update `wrangler.jsonc`
Open [`wrangler.jsonc`](file:///d:/blender/C/ANDUALEM%202.0/wrangler.jsonc) and paste your `database_id`:
```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "andualem-db",
    "database_id": "YOUR_ACTUAL_CLOUDFLARE_D1_DATABASE_ID",
    "migrations_dir": "./migrations"
  }
]
```

### Step 4: Apply Schema Migrations to Production D1
```bash
npx wrangler d1 migrations apply DB --remote
```

### Step 5: Deploy Worker & Static Assets to Cloudflare
```bash
npx wrangler deploy
```

---

## 💾 3. Data Backup & Export Strategy

### Option A: Portable JSON Backup (Built-in Web UI)
1. Open the application.
2. Navigate to **SETTINGS ⚙️ ➔ DATA BACKUP & EXPORT**.
3. Click **💾 EXPORT ALL DATA** to download `ANDUALEM_2_0_BACKUP_YYYY-MM-DD.json`.
4. You can restore this backup anytime using the **📁 IMPORT BACKUP JSON** button.

### Option B: Cloudflare D1 CLI Export
To create a raw SQL backup of your production D1 database:
```bash
npx wrangler d1 backup export andualem-db --remote
```

---

## 🧪 4. Verification Checklist

1. **Local Worker & D1 Sandbox**:
   - Run `npx wrangler dev`
   - Create a task, record a deep work session, and add a project.
   - Refresh browser; verify data persists in local D1 sandbox.

2. **Production Cloudflare Worker**:
   - Run `npx wrangler deploy`
   - Open your Workers sub-domain (`https://andualem-2-0.<your-subdomain>.workers.dev`).
   - Verify Today view, Dashboard progress rings, Deep Work logger, Builds tracker, and Shift Analysis load cleanly.
