# Stable Baseline — v0.9.0-stable

## Snapshot

| Field | Value |
|---|---|
| Date | 2026-07-02 |
| Commit | `2e26345b729c084ac0bb80cdb562cb706b01e232` |
| Tag | `v0.9.0-stable` |
| Frontend | https://bukra-score.vercel.app |
| Backend | https://bukra-score.onrender.com |
| API base | https://bukra-score.onrender.com/api |
| Supabase project ref | `anxwavwkoayqgqyxxtru` |

## Verified features

| Feature | Endpoint / Location | Status |
|---|---|---|
| Scanner | `/scanner` | ✓ |
| Company page | `/company/:symbol` | ✓ |
| Bukra Score | `score.score` in `/api/company/:symbol/page` | ✓ |
| Financial data | `financials.history` (4 years for AAPL/MSFT/NVDA) | ✓ |
| AI Explanation | `explanation` field in company response | ✓ |
| Rules | `rules` field in company response | ✓ |
| Guest mode | `guest: true` handled gracefully — shows company info + locked sections, never "cannot load" | ✓ |
| Diagnostics | `/system-check` — 10 live in-browser checks | ✓ |
| Cache v3 | `bukra_page_cache_v3` key; old v1/v2/unversioned entries evicted on load | ✓ |
| Retry / backoff | `fetchWithRetry`: 45s AbortController timeout, 8s backoff, 1 retry (absorbs Render cold start) | ✓ |
| Content-type guard | HTML responses from misconfigured proxy throw a clear error before `res.json()` | ✓ |
| Health endpoint | `/health` returns `auth.jwt_configured` + `note` field | ✓ |
| ThreadPoolExecutor timeout | `info_fut.result(timeout=35)` + `fin_fut.result(timeout=35)` — hung yfinance calls fail fast | ✓ |

## Known deferred features

These exist in branch `backup-current-broken-state` and were deliberately not merged into this baseline. Each requires its own verification pass before being introduced.

| Feature | Risk | Prerequisite before merging |
|---|---|---|
| `AuthContext` | Medium | Verify `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel are correct |
| `Login` page (`/login`) | Medium | AuthContext working end-to-end |
| `AdminLogin` page (`/admin/login`) | Medium | Confirm `app_metadata.role=admin` is set on Supabase admin user |
| `UserMenu` component | Low | AuthContext |
| `AuthGuard` component | Medium | AuthContext |
| `AdminGuard` rewrite (role-based) | **High** | Confirm admin role in `app_metadata` before switching from current key-based guard |
| Backend guest stripping (`optional_user` in `company.py`) | **High** | Prove JWT auth chain end-to-end via `/system-check` while logged in |
| Research Desk (`/desk`) | Medium | AuthContext + UserDataContext |
| Collections / SaveModal | Low | Research Desk |
| Research Notes | Low | Research Desk |

## Architecture at this baseline

```
Vercel (frontend)
  └── React + Vite + Tailwind
  └── Supabase client (session-only, no auth UI yet)
  └── client.ts: sends Authorization header when session exists

Render (backend)
  └── FastAPI + Python
  └── No guest stripping — all requests receive full payload
  └── ThreadPoolExecutor with 35s timeout on yfinance calls
  └── SUPABASE_JWT_SECRET configured (ready for future auth enforcement)

Supabase
  └── Auth configured (email + Google OAuth)
  └── JWT secret set on Render
  └── No active auth gating in this baseline
```

## Debug playbook (quick reference)

1. Check frontend loads
2. Check `/health` on Render — verify `auth.jwt_configured`
3. Check `/api/company/AAPL/page` directly — verify `score` + `financials.history`
4. Open `/system-check` for a full 10-point live diagnostic
5. If 404 → check `VITE_API_URL` in Vercel (must be `https://bukra-score.onrender.com/api`)
6. If HTML instead of JSON → `VITE_API_URL` is wrong
7. If guest data only → check `SUPABASE_JWT_SECRET` on Render + auth chain via `/system-check`
8. If 500 → check Render logs
9. **Fix config before touching code**
