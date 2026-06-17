import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from limiter import limiter
from routers.company import router as company_router
from routers.scanner import router as scanner_router, trigger_scan_if_idle
from routers.accuracy import router as accuracy_router
from services.accuracy_db import init_db

load_dotenv()

# ── CORS ──────────────────────────────────────────────────────────────────────
# List only exact origins — no wildcard regex.
# Add extra origins at deploy time via ALLOWED_ORIGINS env var (comma-separated).
_base_origins = [
    "https://bukra-score.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]
_extra = os.getenv("ALLOWED_ORIGINS", "")
_extra_origins = [o.strip() for o in _extra.split(",") if o.strip()]
_allowed_origins = list(dict.fromkeys(_base_origins + _extra_origins))

# ── App ────────────────────────────────────────────────────────────────────────
# Disable interactive API docs in production to avoid exposing schema publicly.
# Set ENV=development locally or in CI to re-enable.
_env = os.getenv("ENV", "production")
_is_dev = _env == "development"

app = FastAPI(
    title="Bukra Capital API",
    version="1.0.0",
    docs_url="/docs"          if _is_dev else None,
    redoc_url="/redoc"        if _is_dev else None,
    openapi_url="/openapi.json" if _is_dev else None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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


# ── Global error handler ───────────────────────────────────────────────────────
# Catches any unhandled exception and returns a generic user-facing message.
# Stack traces are printed to server logs only — never sent to clients.
@app.exception_handler(Exception)
async def _generic_error(request: Request, exc: Exception):
    print(f"[error] {request.method} {request.url.path} — {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "שגיאה פנימית. אנא נסה שוב."},
    )


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    init_db()

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
    print("[scheduler] Weekly scan — Mondays 02:00 UTC")


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}
