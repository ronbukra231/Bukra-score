"""
Provider monitoring — thread-safe in-memory counters.
Logged hourly via the APScheduler job wired in main.py.
"""
import logging
import threading
import time

logger = logging.getLogger("bukra.monitor")

_lock = threading.Lock()

_metrics: dict = {
    "fmp_requests":        0,
    "fmp_successes":       0,
    "fmp_failures":        0,
    "fmp_fallbacks":       0,
    "shadow_divergences":  [],  # list of {symbol, field, yahoo, fmp, ts}
    "started_at":          time.time(),
}


def record_success(provider: str, data_type: str):
    with _lock:
        _metrics[f"{provider}_requests"] = _metrics.get(f"{provider}_requests", 0) + 1
        _metrics[f"{provider}_successes"] = _metrics.get(f"{provider}_successes", 0) + 1


def record_failure(provider: str, data_type: str):
    with _lock:
        _metrics[f"{provider}_requests"] = _metrics.get(f"{provider}_requests", 0) + 1
        _metrics[f"{provider}_failures"] = _metrics.get(f"{provider}_failures", 0) + 1


def record_fallback(symbol: str, data_type: str):
    with _lock:
        _metrics["fmp_fallbacks"] = _metrics.get("fmp_fallbacks", 0) + 1
    logger.warning("[monitor] yahoo-fallback: symbol=%s type=%s", symbol, data_type)


def record_shadow_divergence(symbol: str, field: str, yahoo_val, fmp_val):
    entry = {
        "symbol": symbol,
        "field":  field,
        "yahoo":  yahoo_val,
        "fmp":    fmp_val,
        "ts":     time.time(),
    }
    with _lock:
        divs = _metrics["shadow_divergences"]
        divs.append(entry)
        if len(divs) > 200:
            divs.pop(0)


def get_snapshot() -> dict:
    with _lock:
        snap = {k: (list(v) if isinstance(v, list) else v) for k, v in _metrics.items()}

    fmp_req  = snap.get("fmp_requests", 0)
    fmp_fail = snap.get("fmp_failures", 0)
    fmp_fall = snap.get("fmp_fallbacks", 0)
    snap["fmp_failure_rate_pct"]  = round(fmp_fail / fmp_req * 100, 1) if fmp_req else 0.0
    snap["fmp_fallback_rate_pct"] = round(fmp_fall / fmp_req * 100, 1) if fmp_req else 0.0
    snap["uptime_seconds"]        = round(time.time() - snap.get("started_at", time.time()))
    return snap


def log_hourly_report():
    snap = get_snapshot()
    logger.info(
        "[monitor] hourly | fmp_req=%d succ=%d fail=%d fallback=%d fail_rate=%.1f%% fallback_rate=%.1f%% divergences=%d",
        snap.get("fmp_requests", 0),
        snap.get("fmp_successes", 0),
        snap.get("fmp_failures", 0),
        snap.get("fmp_fallbacks", 0),
        snap["fmp_failure_rate_pct"],
        snap["fmp_fallback_rate_pct"],
        len(snap.get("shadow_divergences", [])),
    )
    if snap["fmp_failure_rate_pct"] > 20:
        logger.error(
            "[monitor] ALERT: FMP failure rate %.1f%% exceeds 20%% threshold",
            snap["fmp_failure_rate_pct"],
        )
    if snap["fmp_fallback_rate_pct"] > 50:
        logger.error(
            "[monitor] ALERT: FMP fallback rate %.1f%% exceeds 50%% threshold — consider rollback",
            snap["fmp_fallback_rate_pct"],
        )
