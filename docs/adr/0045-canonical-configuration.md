# ADR 0045 — Canonical configuration: Settings singleton + one API_URL + storage keys

## Status

Accepted

- Date: 2026-09-10
- Deciders: refactor agent (Phase 2 canonicals)
- Tags: `config`, `backend`, `frontend`, `state`

## Context

Backend config lives in `core/config.py Settings` (190 lines, all env) but `main.py:65-67` re-implements serverless detection (`VERCEL/AWS_LAMBDA_FUNCTION_NAME/IS_SERVERLESS`) already present at `config.py:141`, and `main.py:191-195` reads `UPDATES_DIR/STATIC_UPDATES_DIR` instead of `settings.updates_dir`. Frontend has three `API_URL` defaults (`lib/request.js:3`, `lib/googleContacts.js:4`, `lib/googleMail.js:7`) plus `utils/popupOAuth.js:56` and `PreviewPane.jsx:8-10` URL resolution. 99 `localStorage|sessionStorage` hits use 30+ string literals while `hooks/usePersistentState.js` (the correct pattern) is nearly unused. Env files (`server/.env`, `.env.example`, `.env.docker.example`, `.env.prod`) have no ownership table. See `CODEBASE_AUDIT.md` §3.3, §3.9.

## Decision

- Chosen approach:
  - Backend: `core/config.py Settings` only. Add `settings.is_serverless` property; `main.py` uses it and `settings.updates_dir`. No new env names; document env-file ownership (local `.env`, prod `.env.prod`, docker example).
  - Frontend: `lib/request.js API_URL` only. New `lib/storageKeys.js` centralizes every `starwaves.*` key; `usePersistentState` is the only persistence hook. `googleContacts/googleMail/popupOAuth/PreviewPane` import `API_URL` (same URLs, no behavior change).
- Scope: `server/app/main.py`, `server/app/core/config.py`, `website/src/lib/request.js` (+ new `storageKeys.js`), `googleContacts.js`, `googleMail.js`, `utils/popupOAuth.js`, `pages/studio/PreviewPane.jsx`, phased `localStorage` call-site migration.
- Migration plan: (1) add `is_serverless` + switch `main.py`; (2) add `storageKeys.js` with current literal values verbatim; (3) repoint `BACKEND_API_URL` usages to `API_URL`; never stage/delete secrets (AGENTS §1.3).

## Consequences

- **Positive:** one place for env/URLs/keys; serverless + updates-dir behavior converges without new flags; key renames become single-point.
- **Negative / Cost:** key-migration touches many components (values preserved verbatim to avoid data loss); `storageKeys.js` is a new file (justified singleton, not sprawl).
- **Follow-up:** Phase 7 migrates theme/avatar/workspace/studio keys to `usePersistentState + storageKeys` with server-wins invariant; Phase 10 documents env-file ownership in `ARCHITECTURE.md`.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep per-module constants | Preserves drift (already 3 divergent `API_URL` defaults). |
| Env-based key prefixes | Adds indirection with no need; keys are app constants, not environment. |

## References

- `CODEBASE_AUDIT.md` §3.3, §3.9
- `server/app/main.py:65-67,191-195`, `server/app/core/config.py:141`
- `website/src/lib/request.js:3`, `website/src/hooks/usePersistentState.js`
