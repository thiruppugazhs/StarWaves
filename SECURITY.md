# Security — Starwaves

## Hardening History (2026-08-26)
- **P0/P1**: fail-closed `AUTH_SECRET_KEY`/`CRON_SECRET`, `secrets` OTP, HMAC verify, BOLA owner guards, SSRF `_assert_public_url`, CORS `*.vercel.app` removal, HSTS/CSP, preview `allow-same-origin` removal, OAuth `targetOrigin` validation, `realpath` traversal, `DOMPurify`, `WHATSAPP_WORKER_SECRET`, `shell=False` delegation.
- **P2**: rate-limit (`core/rate_limit.py` Redis/in-memory, prod-only), `pickle→json` cache, Twilio `X-Twilio-Signature`, RLS `user_isolation_*`, least-privilege `starwaves_app`, docs gated in prod.

## Required Env (prod)
```
AUTH_SECRET_KEY=$(openssl rand -base64 48)
CRON_SECRET=$(openssl rand -hex 32)
WHATSAPP_WORKER_SECRET=$(openssl rand -hex 32)
DATABASE_URL=postgresql+psycopg2://starwaves_app:<strong>@postgres:5432/starwaves
TWILIO_AUTH_TOKEN=...
CORS_ORIGINS=https://starwaves.susindran.in
```

## Scans
```bash
# Secrets
gitleaks detect --source . --verbose
# Deps
pip-audit
npm audit --audit-level=moderate
# Build
npm run lint && npm run build
python -m pytest tests -q
```

## RLS Activation
`psql $DATABASE_URL -f sql/migrations.sql` (idempotent). App sets `SET LOCAL app.current_user_id = '<uid>'` per request when role is `starwaves_app` (future: add middleware).

## Worker Signature
Go worker sends `X-Worker-Signature: hex(HMAC-SHA256(secret, rawBody))` — server verifies in `api/routes/whatsapp/webhook.py`.

## Twilio
Server verifies `X-Twilio-Signature = base64(HMAC-SHA1(url+sorted(params), TWILIO_AUTH_TOKEN))` — bypassed in dev/test (`APP_ENV != production`).
