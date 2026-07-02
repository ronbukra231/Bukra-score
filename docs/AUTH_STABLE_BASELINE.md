# Auth Stable Baseline — v0.9.1-auth-stable

## Snapshot

| Field | Value |
|---|---|
| Date | 2026-07-02 |
| Commit | `b5e2f6ddbfbb3a51bf606cab8b118b407bba00c5` |
| Tag | `v0.9.1-auth-stable` |
| Frontend | https://bukra-score.vercel.app |
| Backend | https://bukra-score.onrender.com |
| API base | https://bukra-score.onrender.com/api |
| Supabase project ref | `anxwavwkoayqgqyxxtru` |

## Verified features

| Feature | Location | Status |
|---|---|---|
| Company page | `/company/:symbol` | ✓ |
| Bukra Score | `score.score` in `/api/company/:symbol/page` | ✓ AAPL = 66 |
| Financial data | `financials.history` — 4 years (AAPL verified) | ✓ |
| Guest mode | `guest: true` → locked sections, no crash | ✓ |
| Diagnostics | `/system-check` — 10 live in-browser checks | ✓ |
| AuthContext | `user / session / loading / role / isAuthenticated / signIn / signInWithGoogle / signOut / getAccessToken` | ✓ |
| Email/password login | `/login` — calls `supabase.auth.signInWithPassword`, Hebrew errors, loading state, redirect to `/` | ✓ |
| Google OAuth login | `/login` — calls `supabase.auth.signInWithOAuth({ provider: 'google' })`, `redirectTo: window.location.origin` | ✓ |
| UserMenu | Home page header — shows "התחבר" when logged out; avatar + dropdown when logged in | ✓ |
| Logout | UserMenu dropdown → `signOut()` → Supabase clears session → redirect to `/` | ✓ |
| Health endpoint | `GET /health` returns `status: ok`, `auth.jwt_configured: true` | ✓ |
| Cache v3 | `bukra_page_cache_v3`; old entries evicted on load | ✓ |
| Retry / backoff | `fetchWithRetry`: 45s timeout, 8s backoff, 1 retry | ✓ |
| Content-type guard | Prevents silent SyntaxError on HTML proxy responses | ✓ |
| ThreadPoolExecutor timeout | `result(timeout=35)` on both yfinance futures | ✓ |

## Authentication architecture at this baseline

```
/login page
  ├── Email/password → supabase.auth.signInWithPassword()
  │     → AuthError | null → Hebrew error or redirect to /
  └── Google OAuth → supabase.auth.signInWithOAuth({ provider: 'google' })
        → browser redirected to Google → callback to Supabase
        → Supabase redirects to window.location.origin
        → onAuthStateChange fires → AuthContext updates

AuthContext (passive layer)
  ├── Reads session on mount via getSession()
  ├── Listens to onAuthStateChange for live updates
  ├── Null-safe: if Supabase unconfigured → loading=false, user=null, works as guest
  └── deriveRole reads app_metadata.role only (server-side, not user-settable)

UserMenu (Home page header)
  ├── Not logged in → "התחבר" link to /login
  └── Logged in → avatar + dropdown (company search / scanner / logout)
```

## Google OAuth prerequisite (Supabase dashboard)

These must be configured in the Supabase dashboard for Google OAuth to work — they are NOT in this codebase:

1. Authentication → Providers → Google: enable + set Client ID + Client Secret
2. Authentication → URL Configuration → Redirect URLs: add `https://bukra-score.vercel.app`

## Explicitly deferred

These features are NOT in this baseline. Each requires its own verification pass.

| Feature | Risk | Prerequisite before merging |
|---|---|---|
| Research Desk (`/desk`) | Medium | AuthContext ✓ + UserDataContext (not yet built) |
| Watchlist | Medium | Research Desk |
| Collections / SaveModal | Low | Research Desk |
| Research Notes | Low | Research Desk |
| `AuthGuard` component | Medium | Audit all routes before gating any |
| `AdminGuard` rewrite (role-based) | **High** | Confirm `app_metadata.role=admin` set on Supabase admin user before switching from current key-based guard |
| Backend guest stripping (`optional_user`) | **High** | Prove JWT chain end-to-end via `/system-check` while logged in |

## Debug playbook (quick reference)

1. Check `/health` on Render — `status: ok`, `auth.jwt_configured: true`
2. Check `/api/company/AAPL/page` — `score.score` present, `financials.history` non-empty, `guest: false`
3. Open `/system-check` for full 10-point live diagnostic
4. If 404 on API calls → check `VITE_API_URL` in Vercel (must be `https://bukra-score.onrender.com/api`)
5. If HTML instead of JSON → `VITE_API_URL` wrong
6. If guest data only → Supabase session not reaching backend (check `SUPABASE_JWT_SECRET` on Render)
7. If Google OAuth fails → check Supabase dashboard: provider enabled + redirect URL allowlisted
8. If email login fails → check Supabase dashboard: email provider enabled, user confirmed
9. **Fix config before touching code**
