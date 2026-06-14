# Bukra Capital — Deployment Guide

## Architecture

```
Vercel (frontend)  ──HTTPS──▶  Render (backend API)
                                    │
                               SQLite (data/)
                               scanner_cache.json
```

- **Frontend**: React + Vite → static build → Vercel
- **Backend**: FastAPI + uvicorn → Render Web Service
- **Database**: SQLite (file-based, lives in `/data` on Render Disk)

---

## Backend — Render

### 1. Create a Web Service on Render

- **Repository**: connect your GitHub repo
- **Root directory**: `backend`
- **Runtime**: Python 3.11
- **Build command**: `pip install -r requirements.txt`
- **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 2. Add a Persistent Disk (required for SQLite + scan cache)

In the Render dashboard → your service → **Disks** → Add Disk:
- **Mount path**: `/data`
- **Size**: 1 GB (free tier minimum)

Then set the `DATA_DIR` environment variable so the app writes there:
- `DATA_DIR=/data`

> Without a persistent disk, `accuracy.db` and `scanner_cache.json` are reset on every deploy.

### 3. Environment Variables on Render

| Variable | Value | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | your Anthropic key | Yes (for AI explanations) |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` | Yes |
| `DATA_DIR` | `/data` | Yes (if using Render Disk) |

Set these under **Environment → Environment Variables** in the Render dashboard.

---

## Frontend — Vercel

### 1. Import project on Vercel

- **Root directory**: `frontend`
- **Framework preset**: Vite
- **Build command**: `npm run build`
- **Output directory**: `dist`

### 2. Environment Variables on Vercel

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-backend.onrender.com/api` |

Set this under **Project Settings → Environment Variables** in the Vercel dashboard.

> `VITE_` prefix is required — Vite only exposes env vars with this prefix to the browser bundle.

### 3. SPA routing (important)

Create `frontend/public/vercel.json` if not already present:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This makes React Router work on page refresh for `/company/AAPL`, `/scanner`, etc.

---

## Local Development

No changes to local workflow. The dev proxy still routes `/api` → `localhost:8000`.

```bash
# Terminal 1 — backend
cd backend
source venv/bin/activate
pip install -r requirements.txt   # first time, or after requirements change
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install                        # first time
npm run dev                        # http://localhost:5173
```

The `VITE_API_URL` env var is **not set** locally, so `client.ts` falls back to `/api` which Vite proxies to the backend.

---

## Weekly Scan

The scanner runs automatically every **Monday at 02:00 UTC** via APScheduler (started at app startup).

- Bukra Score measures long-term business quality — weekly cadence is intentional.
- If a scan is already running when the schedule fires, it is skipped safely.
- Users can always trigger a manual refresh via the **Refresh Scan** button in the UI.
- Results are persisted to `scanner_cache.json` and survive restarts (requires Render Disk).

---

## Health Check

```
GET /health
→ { "status": "ok", "service": "bukra-capital-api" }
```

Render uses this endpoint for uptime monitoring. Configure it under **Health & Alerts → Health Check Path**: `/health`.

---

## Summary

| What | Command / Value |
|---|---|
| **Backend build** | `pip install -r requirements.txt` |
| **Backend start** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Frontend build** | `npm run build` |
| **Frontend output** | `dist/` |
| **Required env (backend)** | `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`, `DATA_DIR` |
| **Required env (frontend)** | `VITE_API_URL` |
| **Recommended hosting** | Render (backend) + Vercel (frontend) |
| **Weekly scan** | Automatic — Mondays 02:00 UTC |
| **Health check** | `GET /health` |
