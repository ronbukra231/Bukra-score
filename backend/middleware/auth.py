"""
JWT verification for Supabase-issued tokens.

Usage in route handlers:
    from middleware.auth import require_user, optional_user, require_admin
    from fastapi import Depends

    @router.get("/protected")
    async def route(user = Depends(require_user)):
        ...

    @router.get("/optional")
    async def route(user = Depends(optional_user)):
        # user is None if no valid token
        ...
"""

import os
from typing import Optional
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

try:
    import jwt as pyjwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

_bearer = HTTPBearer(auto_error=False)

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def _decode_token(token: str) -> Optional[dict]:
    if not JWT_AVAILABLE or not SUPABASE_JWT_SECRET:
        return None
    try:
        return pyjwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except Exception:
        return None


def _get_role(payload: dict) -> str:
    return payload.get("app_metadata", {}).get("role", "user")


async def optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    """Returns the decoded JWT payload, or None if unauthenticated."""
    if not credentials:
        return None
    return _decode_token(credentials.credentials)


async def require_user(
    user: Optional[dict] = Depends(optional_user),
) -> dict:
    """Raises 401 if not authenticated."""
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def require_admin(
    user: dict = Depends(require_user),
) -> dict:
    """Raises 403 if authenticated but not admin."""
    if _get_role(user) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
