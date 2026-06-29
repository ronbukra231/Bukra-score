import logging
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
from routers.intelligence import router as intelligence_router
from services.accuracy_db import init_db
from services.provider_monitor import log_hourly_report, get_snapshot

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("bukra.main")

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
app.include_router(intelligence_router)


# ── Security headers middleware ────────────────────────────────────────────────
# Added to every response. Does not affect CORS or rate-limit responses.
@app.middleware("http")
async def _security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "0"  # Modern browsers ignore; CSP handles it
    # Tight CSP: API only returns JSON, never renders HTML content
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response


# ── Global error handler ───────────────────────────────────────────────────────
# Catches any unhandled exception and returns a generic user-facing message.
# Stack traces go to server logs only — never sent to clients.
@app.exception_handler(Exception)
async def _generic_error(request: Request, exc: Exception):
    logger.error("[error] %s %s — %s: %s", request.method, request.url.path, type(exc).__name__, exc)
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
    scheduler.add_job(
        log_hourly_report,
        trigger="interval",
        hours=1,
        id="provider_monitor",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[scheduler] Weekly scan — Mondays 02:00 UTC")
    logger.info("[scheduler] Provider monitor — every hour")


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    snap = get_snapshot()
    fmp_key_set = bool(os.getenv("FMP_API_KEY", "").strip())
    provider    = os.getenv("DATA_PROVIDER", "auto") if fmp_key_set else "yahoo"
    fmp_status  = "ok" if snap["fmp_failure_rate_pct"] < 20 else "degraded"
    return {
        "status":   "ok",
        "provider": provider,
        "fmp": {
            "configured": fmp_key_set,
            "status":     fmp_status if fmp_key_set else "not_configured",
            "requests":   snap.get("fmp_requests", 0),
            "failure_rate_pct": snap["fmp_failure_rate_pct"],
            "fallback_rate_pct": snap["fmp_fallback_rate_pct"],
        },
        "shadow_divergences_logged": len(snap.get("shadow_divergences", [])),
    }
