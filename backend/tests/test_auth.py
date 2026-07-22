"""
Unit tests for services/auth.py — dual-mode Supabase JWT verification
(legacy HS256 shared secret, and asymmetric RS256/ES256 via JWKS).

Run: venv/bin/python -m pytest tests/test_auth.py -q   (from backend/)
"""

import os
import sys
import time
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from services import auth as auth_module

TEST_SECRET = "test-secret-for-pytest-auth"
TEST_ISSUER = "https://test-project.supabase.co/auth/v1"
TEST_URL = "https://test-project.supabase.co"


def hs256_token(sub="user-123", secret=TEST_SECRET, aud="authenticated",
                iss=None, exp_delta=3600, **extra):
    now = int(time.time())
    payload = {"sub": sub, "aud": aud, "exp": now + exp_delta, "iat": now, **extra}
    if iss is not None:
        payload["iss"] = iss
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def with_secret(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    yield


@pytest.fixture
def with_secret_and_issuer(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    monkeypatch.setenv("SUPABASE_URL", TEST_URL)
    yield


# ── Missing / malformed ───────────────────────────────────────────────────────

def test_missing_header(with_secret):
    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user_id(authorization="")
    assert exc.value.status_code == 401


def test_missing_bearer_prefix(with_secret):
    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user_id(authorization="Basic abc123")
    assert exc.value.status_code == 401


def test_malformed_token(with_secret):
    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user_id(authorization="Bearer not-a-real-jwt")
    assert exc.value.status_code == 401
    assert "אימות נכשל" in exc.value.detail


# ── Valid / expired / refreshed (HS256 legacy path) ───────────────────────────

def test_valid_hs256_token(with_secret):
    token = hs256_token(sub="user-abc")
    uid = auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert uid == "user-abc"


def test_expired_token(with_secret):
    token = hs256_token(exp_delta=-3600)
    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401
    assert "פג תוקף" in exc.value.detail


def test_refreshed_token_is_accepted_like_any_valid_token(with_secret):
    # A "refreshed" token is, from the backend's point of view, simply a new
    # valid token with a later expiry — verified the same way as any other.
    expired = hs256_token(exp_delta=-10)
    with pytest.raises(HTTPException):
        auth_module.get_current_user_id(authorization=f"Bearer {expired}")
    refreshed = hs256_token(sub="user-abc", exp_delta=3600)
    uid = auth_module.get_current_user_id(authorization=f"Bearer {refreshed}")
    assert uid == "user-abc"


def test_clock_skew_leeway_tolerates_small_negative_exp(with_secret):
    # Just past expiry, within the configured leeway — must still pass.
    token = hs256_token(exp_delta=-(auth_module._LEEWAY_SECONDS - 2))
    uid = auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert uid == "user-123"


# ── Wrong issuer / audience ───────────────────────────────────────────────────

def test_wrong_audience_rejected(with_secret):
    token = hs256_token(aud="some-other-app")
    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


def test_wrong_issuer_rejected_when_issuer_configured(with_secret_and_issuer):
    token = hs256_token(iss="https://a-different-project.supabase.co/auth/v1")
    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


def test_correct_issuer_accepted_when_issuer_configured(with_secret_and_issuer):
    token = hs256_token(iss=TEST_ISSUER)
    uid = auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert uid == "user-123"


def test_issuer_not_enforced_when_supabase_url_unset(with_secret):
    # No SUPABASE_URL configured → issuer cannot be known, so it is not
    # enforced (signature + expiry + audience still are).
    token = hs256_token(iss="https://anything.supabase.co/auth/v1")
    uid = auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert uid == "user-123"


# ── Backend auth configuration failure (503, not "authentication failed") ────

def test_no_secret_and_no_url_returns_503(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    token = hs256_token()
    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert exc.value.status_code == 503
    assert "אימות נכשל" not in exc.value.detail  # never disguised as an auth failure


def test_asymmetric_token_without_supabase_url_returns_503(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_SECRET)
    # A token whose header claims RS256 — never actually verified, since the
    # missing SUPABASE_URL is caught before any signature check.
    unsigned_header_token = jwt.encode(
        {"sub": "x", "exp": int(time.time()) + 3600}, "irrelevant", algorithm="HS256")
    # Forge the header to RS256 without a real RSA signature to exercise the
    # routing branch — decode() never runs because the config guard fires first.
    with patch.object(auth_module.jwt, "get_unverified_header", return_value={"alg": "RS256"}):
        with pytest.raises(HTTPException) as exc:
            auth_module.get_current_user_id(authorization=f"Bearer {unsigned_header_token}")
    assert exc.value.status_code == 503


def test_unsupported_algorithm_rejected(with_secret):
    token = hs256_token()
    with patch.object(auth_module.jwt, "get_unverified_header", return_value={"alg": "none"}):
        with pytest.raises(HTTPException) as exc:
            auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


# ── Asymmetric signing keys via JWKS (RS256) ──────────────────────────────────

@pytest.fixture
def rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


def test_valid_rs256_token_via_jwks(monkeypatch, rsa_keypair):
    private_key, public_key = rsa_keypair
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.setenv("SUPABASE_URL", TEST_URL)

    now = int(time.time())
    token = jwt.encode(
        {"sub": "user-rsa", "aud": "authenticated", "iss": TEST_ISSUER, "exp": now + 3600, "iat": now},
        private_key, algorithm="RS256", headers={"kid": "test-key-1"},
    )

    fake_signing_key = SimpleNamespace(key=public_key)
    with patch.object(auth_module, "_get_jwks_client") as mock_get_client:
        mock_get_client.return_value.get_signing_key_from_jwt.return_value = fake_signing_key
        uid = auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert uid == "user-rsa"


def test_rs256_token_wrong_key_rejected(monkeypatch, rsa_keypair):
    _, real_public_key = rsa_keypair
    other_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.setenv("SUPABASE_URL", TEST_URL)

    now = int(time.time())
    # Signed with a DIFFERENT private key than the one JWKS will return.
    token = jwt.encode(
        {"sub": "user-rsa", "aud": "authenticated", "exp": now + 3600, "iat": now},
        other_private_key, algorithm="RS256",
    )
    fake_signing_key = SimpleNamespace(key=real_public_key)
    with patch.object(auth_module, "_get_jwks_client") as mock_get_client:
        mock_get_client.return_value.get_signing_key_from_jwt.return_value = fake_signing_key
        with pytest.raises(HTTPException) as exc:
            auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


def test_jwks_fetch_failure_returns_503(monkeypatch, rsa_keypair):
    private_key, _ = rsa_keypair
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.setenv("SUPABASE_URL", TEST_URL)
    now = int(time.time())
    token = jwt.encode({"sub": "x", "exp": now + 3600}, private_key, algorithm="RS256")

    with patch.object(auth_module, "_get_jwks_client") as mock_get_client:
        mock_get_client.return_value.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientError("network down")
        with pytest.raises(HTTPException) as exc:
            auth_module.get_current_user_id(authorization=f"Bearer {token}")
    assert exc.value.status_code == 503


# ── No secrets ever logged ────────────────────────────────────────────────────

def test_secret_never_appears_in_exception_detail(with_secret):
    bad_token = jwt.encode({"sub": "x", "exp": int(time.time()) + 3600}, "wrong-secret", algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user_id(authorization=f"Bearer {bad_token}")
    assert TEST_SECRET not in str(exc.value.detail)
