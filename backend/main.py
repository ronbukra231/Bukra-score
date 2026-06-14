import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from routers.company import router as company_router
from routers.scanner import router as scanner_router, trigger_scan_if_idle
from routers.accuracy import router as accuracy_router
from services.accuracy_db import init_db

load_dotenv()

# ── CORS ──────────────────────────────────────────────────────────────────────
# Set ALLOWED_ORIGINS in production (comma-separated URLs).
# Defaults to localhost for local development.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(title="Bukra Capital API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(company_router)
app.include_router(scanner_router)
app.include_router(accuracy_router)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    init_db()

    # Weekly scheduled scan — runs every Monday at 02:00 UTC.
    # Bukra Score is a long-term metric; weekly cadence is intentional.
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        trigger_scan_if_idle,
        trigger="cron",
        day_of_week="mon",
        hour=2,
        minute=0,
        id="weekly_scan",
        replace_existing=True,
    )
    scheduler.start()
    print("[scheduler] Weekly scan registered — runs Mondays 02:00 UTC")


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "bukra-capital-api"}
