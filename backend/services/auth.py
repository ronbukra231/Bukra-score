"""
Authentication — Supabase JWT verification.

Supabase projects sign access tokens one of two ways:

  1. Legacy symmetric secret (HS256) — the project's "JWT Secret", shared
     between Supabase and this backend via SUPABASE_JWT_SECRET.
  2. Newer asymmetric signing keys (RS256 / ES256) — verified against the
     project's public JWKS endpoint, never a shared secret.

Projects created after Supabase introduced asymmetric signing keys default
to method 2; older projects may still use method 1. This module does not
assume either — it reads the token's own `alg` header to route to the
correct verification path, so it works correctly for whichever method the
live Supabase project actually uses. (The `alg` header is untrusted input
and is used ONLY to pick which code path runs, never to choose what key
material to trust with — the HS256 path always requires the server-side
secret and never touches JWKS key bytes, and the asymmetric path always
requires a real signature check against Supabase's own public key, so a
forged `alg` cannot downgrade or confuse verification.)

Nothing else in this backend verifies the Authorization header server side
(company.py's "guest" gating is client-side only). This is the only place
identity is established, and it is the ownership boundary for the Portfolio
Simulator's per-user data.
"""

import os
import logging
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException

logger = logging.getLogger("bukra.auth")

# Clock-skew tolerance between this server and Supabase's auth server.
_LEEWAY_SECONDS = 10

_ASYMMETRIC_ALGS = ("RS256", "ES256")

_jwks_client: Optional[PyJWKClient] = None


def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").rstrip("/")


def _audience() -> str:
    # Supabase's standard audience claim for authenticated users. Only
    # override this if the project's Supabase auth config sets a custom one.
    return os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")


def _issuer() -> Optional[str]:
    url = _supabase_url()
    return f"{url}/auth/v1" if url else None


def _config_error(lang_detail: str) -> HTTPException:
    """
    A backend configuration/infrastructure problem — distinct from a bad
    token. Never reported to the client as "authentication failed": that
    phrase means the USER did something (or their session expired); this
    means the SERVER isn't set up correctly, which the user cannot fix by
    logging in again.
    """
    return HTTPException(status_code=503, detail=lang_detail)


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = _supabase_url()
        if not url:
            raise _config_error("תצורת האימות בשרת אינה תקינה כרגע. (SUPABASE_URL חסר)")
        jwks_url = f"{url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    return _jwks_client


def _verify_hs256(token: str) -> dict:
    secret = os.getenv("SUPABASE_JWT_SECRET", "")
    if not secret:
        raise _config_error("תצורת האימות בשרת אינה תקינה כרגע. (SUPABASE_JWT_SECRET חסר)")
    return jwt.decode(
        token, secret, algorithms=["HS256"],
        audience=_audience(), issuer=_issuer(),
        leeway=_LEEWAY_SECONDS,
        options={"verify_aud": True, "verify_iss": _issuer() is not None},
    )


def _verify_asymmetric(token: str, alg: str) -> dict:
    client = _get_jwks_client()
    try:
        signing_key = client.get_signing_key_from_jwt(token)
    except jwt.PyJWKClientError as e:
        # JWKS fetch/parse failure (network, unreachable Supabase, bad
        # SUPABASE_URL) — an infrastructure problem, not an invalid token.
        logger.error("[auth] JWKS lookup failed: %s", type(e).__name__)
        raise _config_error("תצורת האימות בשרת אינה תקינה כרגע.")
    return jwt.decode(
        token, signing_key.key, algorithms=[alg],
        audience=_audience(), issuer=_issuer(),
        leeway=_LEEWAY_SECONDS,
        options={"verify_aud": True, "verify_iss": _issuer() is not None},
    )


def get_current_user_id(authorization: str = Header(default="")) -> str:
    """
    FastAPI dependency: extracts and verifies the Supabase user id from the
    Authorization: Bearer <jwt> header.

      401 — missing header, expired token, or invalid/malformed token
      503 — the backend's own auth configuration is broken (missing secret,
            missing SUPABASE_URL, or Supabase's JWKS endpoint unreachable)

    These are deliberately different status codes: a 401 tells the user to
    log in again; a 503 means logging in again will not help.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="נדרשת התחברות למערכת.")
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="נדרשת התחברות למערכת.")

    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="אימות נכשל. אנא התחבר מחדש.")

    alg = header.get("alg", "")

    try:
        if alg == "HS256":
            payload = _verify_hs256(token)
        elif alg in _ASYMMETRIC_ALGS:
            payload = _verify_asymmetric(token, alg)
        else:
            logger.warning("[auth] unsupported token algorithm: %s", alg)
            raise HTTPException(status_code=401, detail="אימות נכשל. אנא התחבר מחדש.")
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="פג תוקף ההתחברות. אנא התחבר מחדש.")
    except jwt.InvalidTokenError as e:
        # Wrong issuer, wrong audience, bad signature, malformed claims —
        # all genuinely invalid-token cases, never the server's fault.
        logger.warning("[auth] token rejected: %s", type(e).__name__)
        raise HTTPException(status_code=401, detail="אימות נכשל. אנא התחבר מחדש.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="אימות נכשל. אנא התחבר מחדש.")
    return user_id
