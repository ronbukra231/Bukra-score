from slowapi import Limiter
from starlette.requests import Request


def _real_ip(request: Request) -> str:
    """
    Extract the real client IP.
    On Render (and most PaaS), the app sits behind a reverse proxy that sets
    X-Forwarded-For. Using the raw remote_addr would treat the proxy as a single
    client and rate-limit ALL users as one.
    Falls back to remote_addr if the header is absent (local dev).
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Header may contain a comma-separated list; first entry is the real client
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_real_ip)
