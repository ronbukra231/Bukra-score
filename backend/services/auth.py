"""
Authentication — Supabase JWT verification.

Nothing in this backend previously verified the Authorization header server
side; company.py's "guest" gating happens entirely client-side. The
Portfolio Simulator is the first feature that stores per-user financial
state, so a server-side identity check is required to guarantee "a user
must never access another user's portfolio."

Supabase issues HS256 JWTs signed with SUPABASE_JWT_SECRET (the project's
JWT secret, already read at startup in main.py). We verify the signature
and expiry and take `sub` as the stable user id.
"""

import os
import logging

import jwt
from fastapi import Header, HTTPException

logger = logging.getLogger("bukra.auth")

_ALGO = "HS256"


def _secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    if not secret:
        raise HTTPException(status_code=503, detail="שירות האימות אינו זמין כרגע.")
    return secret


def get_current_user_id(authorization: str = Header(default="")) -> str:
    """
    FastAPI dependency: extracts and verifies the Supabase user id from the
    Authorization: Bearer <jwt> header. Raises 401 on any failure — missing
    header, expired token, bad signature, or missing subject claim.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="נדרשת התחברות למערכת.")
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="נדרשת התחברות למערכת.")

    try:
        payload = jwt.decode(
            token, _secret(), algorithms=[_ALGO],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="פג תוקף ההתחברות. אנא התחבר מחדש.")
    except jwt.InvalidTokenError as e:
        logger.warning("[auth] token rejected: %s", type(e).__name__)
        raise HTTPException(status_code=401, detail="אימות נכשל. אנא התחבר מחדש.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="אימות נכשל. אנא התחבר מחדש.")
    return user_id
