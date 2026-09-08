# ADR 0006 — Canonical domain starwaves.susindran.in + api.starwaves.susindran.in

## Status

Accepted

- Date: 2026-08-31
- Deciders: @susin-d
- Tags: `infra`, `domains`, `vercel`, `gcp`, `nginx`, `cors`, `email`, `oauth`, `safe-browsing`

## Context

After split deploy (Vercel `website/` + GCP VM `server/postgres/redis/nginx`), the canonical split is `https://starwaves.susindran.in` (frontend) and `https://api.starwaves.susindran.in` (backend). Backend already serves `api.starwaves.susindran.in` in `nginx/conf.d/default.backend.conf` (`server_name api.starwaves.susindran.in` + 302 `/` → `starwaves.susindran.in`) and `request.js` warns to set `VITE_API_URL=https://api.starwaves.susindran.in/api/v1` in Vercel prod.

In production, `server/.env` was still `FRONTEND_URL=https://starwaves.vercel.app` (from `.env.docker.example:31` and `DEPLOY_GCP_VERCEL.md:45`). All email links (`server/app/services/email.py:132` `send_account_combine_email`, plus `send_verification_email`, `send_password_reset_email`) and OAuth `postMessage` `targetOrigin` (`server/app/api/routes/auth/oauth.py:30,80,157` + `server/app/core/config.py:75`) were therefore generated with the Vercel default host. Screenshot `2026-08-31` shows `https://starwaves.vercel.app/#combine-account?token=...` flagged as `Dangerous site — phishing` by Chrome Safe Browsing. The shared `*.vercel.app` suffix plus token-in-hash pattern triggered the flag; the custom domain has isolated reputation and avoids this. `*.vercel.app` must remain allowed for preview deploys, but must not be the canonical link host.

## Decision

Make `starwaves.susindran.in` the single canonical frontend origin; keep `api.starwaves.susindran.in` canonical for the API.

- **Vercel:** Add `vercel.json` `redirects` 308 `starwaves.vercel.app → starwaves.susindran.in` (host-conditioned, `permanent:true`) before `rewrites`. Dashboard: add `starwaves.susindran.in` as Primary domain, keep `*.vercel.app` for previews.
- **Backend env:** Change `.env.docker.example:31` `FRONTEND_URL` to `https://starwaves.susindran.in`, comment that `starwaves.vercel.app` is 308-redirected (see `vercel.json`). Keep `CORS_ORIGINS` with both `susindran.in` + `vercel.app` + `*.vercel.app`.
- **Docs:** Update `DEPLOY_GCP_VERCEL.md:42-45,63-65,102-112` to reflect canonical `FRONTEND_URL` and new Domains step. Scope: `vercel.json`, `.env.docker.example`, `DEPLOY_GCP_VERCEL.md`.
- **Runtime:** On VM, set `server/.env` `FRONTEND_URL=https://starwaves.susindran.in` and redeploy server; on Vercel set `VITE_API_URL=https://api.starwaves.susindran.in/api/v1` and redeploy.
- **No change:** `nginx/nginx.conf` and `server/app/core/cors.py` already allow both suffixes via regex maps, `server/.env.example:5` already canonical, `request.js` already warns correctly.

## Consequences

- **Positive:** Email/OTP/combine links use custom domain, no Safe Browsing flag; OAuth `postMessage` origin matches canonical; `vercel.app` traffic 308s to canonical without content divergence; preview deploys still work via `*.vercel.app` allowlist.
- **Negative / Cost:** One extra 308 hop for old `vercel.app` links/emails until resent; requires VM env redeploy + Vercel env redeploy to take effect.
- **Follow-up:** Resend any outstanding combine/verify emails; submit Safe Browsing review via `Hide details → this unsafe site` + Search Console; optionally migrate email token delivery to `postMessage`-only like Google OAuth already does to avoid token-in-URL.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep `starwaves.vercel.app` as canonical | Shared suffix reputation triggers Safe Browsing phishing flag; cannot brand/custom TLS; violates intended split. |
| Remove `vercel.app` from CORS entirely | Breaks Vercel preview deploys (`*.vercel.app` PR aliases) needed for CI preview. |
| Do nothing and request Safe Browsing exception for `vercel.app` | Exception would be per-URL and fragile; shared suffix still at risk. Canonical domain is correct fix. |
| Add Vercel `domains` config instead of `redirects` | `domains` is Dashboard-owned; `redirects` is the codified edge redirect per Vercel docs. |

## References

- `vercel.json:8-19` — redirects + rewrites
- `.env.docker.example:7-9,30-33`
- `DEPLOY_GCP_VERCEL.md:42-45,63-65,102-112`
- `server/app/services/email.py:108,120,132`
- `server/app/api/routes/auth/oauth.py:30,80,157`
- `server/app/core/config.py:75`
- `nginx/conf.d/default.backend.conf:19,130`
- `nginx/nginx.conf:40-43`
- `server/app/core/cors.py:11-13`
