# ADR 0043 — Single data-access layer: repositories public, db/sql internal

## Status

Accepted

- Date: 2026-09-10
- Deciders: refactor agent (Phase 2 canonicals)
- Tags: `backend`, `data-access`, `single-source-of-truth`

## Context

`server/app` has two parallel data-access stacks: `repositories/*` (24 files, mixed class/function style, plus `helpers.py` soft-delete/snapshot and `pagination.py` collection helpers) and `db/sql/*` (21 files with per-entity `get_*_doc/set_*_doc/delete_*_doc/query_*` plus `base/client/query/registry/_shared/compat/fallback`). Routes, services (`services/eve/*`, `services/whatsapp.py`), and `core/worker.py` import from both layers, and `core/auth.py` reaches into `db.sql.user_sessions` directly. `coerce_model_value/clean_data/json_safe` is repeated per `db/sql` file, and `client.py` exposes two names (`get_db_client/get_firestore`) for the same client. This doubles ownership for every entity and forces each refactor to touch two places. See `CODEBASE_AUDIT.md` §3.1.

## Decision

- Chosen approach: `repositories/*` is the sole public data-access API. `db/sql/*` is an internal driver — no imports from `routes/*` or `services/*` (or `core/*` except `db/` itself) directly into `app.db.sql`.
- Scope: `server/app/repositories/`, `server/app/db/sql/`, call sites in `server/app/api/routes/`, `server/app/services/`, `server/app/core/worker.py`, `server/app/core/auth.py`.
- Migration plan:
  1. `repositories/pagination.py` becomes a pure facade re-exporting `core/pagination.py` (`resolve_limit/encode_cursor/decode_cursor`) — move the `HTTPException(400)` cursor error to callers via `core/errors.bad_request`.
  2. Add a Grep gate (no `from app.db.sql` / `from app.db import` outside `repositories/` + `db/`); fix violations by routing through the matching repository function.
  3. Keep `db/sql/*` behavior identical (strict preservation, schema read-only); dedup `_shared.py` helpers without semantic change.

## Consequences

- **Positive:** one owner per entity; new entities add one repository + one driver module instead of two public APIs; pagination/cursor behavior converges on `core/pagination.py`.
- **Negative / Cost:** large import-touch surface; mixed class/function repository styles remain until Phase 6 (facade preserves paths, no wire change).
- **Follow-up:** Phase 5 moves HTTP out of `repositories/pagination.paginate_collection`; Phase 6 splits `models/__init__.py` with facade; Phase 8 deletes `db/compat.py`/`fallback.py` only after callers migrate.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Make `db/sql/*` public and delete `repositories/` | Repositories already own soft-delete/snapshot/pagination helpers and are imported by services/worker; larger rewrite. |
| Do nothing | Leaves every entity with two owners; violates one-implementation-per-concept. |

## References

- `CODEBASE_AUDIT.md` §3.1, §8
- `server/app/repositories/pagination.py`
- `server/app/core/pagination.py`
- `server/app/db/sql/registry.py`, `server/app/db/sql/client.py`
- `server/app/core/worker.py:9-11`, `server/app/core/auth.py:262`
