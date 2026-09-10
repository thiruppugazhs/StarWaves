# ADR 0044 — Canonical backend errors via core/errors

## Status

Accepted

- Date: 2026-09-10
- Deciders: refactor agent (Phase 2 canonicals)
- Tags: `backend`, `errors`, `api-contract`

## Context

`server/app/core/errors.py` defines 7 helpers (`not_found/bad_request/unauthorized/forbidden/unprocessable/service_unavailable/bad_gateway`) with a "use these" header, but only 5 route files use them (`eve_avatar`, `modeling`, `auth/sessions`, `studio/_shared`, `ui_preferences`). 100+ `raise HTTPException` sites across `ai_models/contacts/calls/cron/auth/*/calls_twilio/email/documents/eve/gmail/github/google_*` hand-roll status codes (`404` vs `HTTP_404_NOT_FOUND`, `400` vs `422` for validation) and messages. `repositories/pagination.py:26,35` even raises `HTTPException` from inside the data layer. This makes error-shape audits and future format changes N×M work. See `CODEBASE_AUDIT.md` §3.2, §4.1.

## Decision

- Chosen approach: `core/errors.py` is the only way routes raise HTTP errors. Codemod every `raise HTTPException(` in `api/routes/*` to the matching helper with **identical status code and message** (strict preservation — including the `400`-vs-`422` inconsistencies, documented not fixed).
- Scope: `server/app/api/routes/` (all groups), `server/app/repositories/pagination.py` (remove FastAPI import; caller maps `ValueError` → `bad_request`), `server/tests/` updates only if assertions match on helper output.
- Migration plan: mechanical per-file pass (`not_found` ← 404, `bad_request` ← 400, `unprocessable` ← 422, `forbidden` ← 403, `service_unavailable` ← 503, `bad_gateway` ← 502); keep `from None`/`from e`/`from error` chaining; `core/auth.py` raw raises migrate in the same pass.

## Consequences

- **Positive:** one error strategy; status/message search becomes one file; future envelope changes are single-point.
- **Negative / Cost:** large diff touching many routes (no behavior change, but review surface is wide); Starlette deprecation `HTTP_422_UNPROCESSABLE_ENTITY` warning stays until a dedicated rename (out of scope).
- **Follow-up:** Phase 9 adds ownership/validation/error-shape tests per merged rule; document the preserved `400`-vs-`422` inconsistency for a future behavior ADR.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep raw `HTTPException` and document codes | Preserves duplication; every new route re-invents messages. |
| Introduce exception middleware mapping domain errors | Larger redesign; changes behavior surface — rejected under strict preservation. |

## References

- `CODEBASE_AUDIT.md` §3.2
- `server/app/core/errors.py`
- `server/app/repositories/pagination.py:26-35`
- `server/app/api/routes/eve.py:274-374`, `server/app/api/routes/contacts.py:43-96`
