# CODEBASE_AUDIT — Single Source of Truth (Phase 1, read-only)

> Date: 2026-09-10 · Scope: `website/` + `server/app/` + `sql/` + `services/whatsapp-worker` + `scripts/` + infra (`docker-compose*.yml`, `nginx/`, `vercel.json`) · Method: direct `Read`+`Grep` per AGENTS §1.5 (no sub-agents, no tree scans) · Behavior: **strict preservation**, schema **read-only** (no migrations in this refactor).
> Dirty-tree note: `git status` at audit time showed uncommitted WhatsApp pagination work (ADR 0042 + `eve_stream/chats/whatsapp` + tests + `WhatsAppChatList/whatsappApi/useWhatsAppPairing/hackathons.css`) plus untracked `docs/adr/0041*`, `server/gen_memories.py`, `server/write_memories.py`. This audit does not judge that work; Phase 3+ must rebase onto it.

---

## 1. Architecture overview

```text
website/ (React 19 + Vite, Vanilla CSS tokens, Monaco, lucide-react)
  pages/ (46 entries incl. packages: calendar, contacts, documents, eve, jobs, mail, projects, studio, whatsapp, workspace, avatar-studio, settings, landing)
  lib/ (40 clients via request.js apiRequest) · hooks/ (useAuth/useRouter/useThemeCustomizer/useWorkspaceData/usePersistentState/call/*)
  components/ui/ primitives (Modal/MailModal/ConfirmDialog/PageHeader/EmptyState/FormField/CustomDropdown/CalendarPicker/TabNav/...)
  styles/tokens.css → base → utilities → responsive → components → pages → layout-symmetry.css · themes/ 26 presets
  src-tauri/ (Tauri v2) + Capacitor/Android updater path
        ↓ HTTPS /api/v1 + /ws/calls + /ws/whatsapp + /updates
server/app/ (FastAPI, Async SQLAlchemy 2.0, Supabase PG16 + pgvector)
  api/router.py (38 route groups) → routes/ (40 entries: auth/*, workspace/*, whatsapp/*, eve+eve_stream, calls+calls_twilio, ai_models+unified_models, eve_speech/eve_avatar/eve_schedules, modeling, ui_preferences, updates/*, cron, health/*, ...)
  services/ (34 entries: eve/* chat/stream/tools/handlers/memories/RAG, ai_models/*, speech/*, twilio/*, oauth/*, web_browsing/*, whatsapp.py 549 lines, ui_preferences, usage, updates, ...)
  repositories/ (24 files: 5 class repos Job/Project/Call/Notification/EveSchedule + function modules todos/documents/contacts/users/eve/eve_sessions/whatsapp/workspace_files/...)
  db/sql/ (21 files: per-entity get_*/set_*/delete_*/query_* + base/client/query/registry/_shared/compat/fallback/settings)
  core/ (auth/errors/http/pagination/cache/config/dependencies/rls/rate_limit/cors/worker/ws/*) · models/__init__.py (409 lines, 18 tables) + mixins · schemas/ (23 files, Pydantic)
  core/worker.py ServerBackgroundWorker (Docker) vs vercel.json cron → /api/v1/cron/execute-schedules (serverless)
sql/ (extensions/schema 309 lines/migrations/indexes) mirrors models/__init__.py via Base.metadata.create_all
services/whatsapp-worker/ (Go WhatsMeow bridge) · nginx/ (10r/s burst 60, Gzip) · scripts/ (build-{android,desktop,ota,all}.ps1+.sh + lib/common + vm-*/pc-* deploy)
```

Dependency direction today is **mostly** `Routes → Services/Repos → Core/Models` but violated in spots (§4).

---

## 2. Current sources of truth

| Data / rule | Authoritative TODAY | Status |
|---|---|---|
| Persistent tables | `sql/schema.sql` + `server/app/models/__init__.py` (mirror, header says so) | CANONICAL (read-only this refactor) |
| Runtime data access | **Split**: `repositories/*` (public) + `db/sql/*` (driver) + `db/compat.py` + `db/sql/registry.py` | VIOLATED — two public paths (§3.1) |
| Pagination | `core/pagination.py` (`resolve_limit/encode_cursor/decode_cursor/PageResponse`, cursor `created_at,id` + `limit+1`) — `repositories/pagination.py` already re-exports it | CANDIDATE-CANONICAL (needs enforcement) |
| Errors | `core/errors.py` (7 helpers, "use these" header) — used by only 5 route files | VIOLATED — 100+ raw `raise HTTPException` (§3.2) |
| Config backend | `core/config.py Settings` (190 lines, all env) | CANDIDATE-CANONICAL, bypassed by `main.py` (§3.3) |
| Config frontend | `lib/request.js API_URL` (`VITE_API_URL ?? 127.0.0.1:8000/api/v1`) | CANDIDATE-CANONICAL, duplicated (§3.3) |
| API client | `lib/request.js apiRequest` (dedup + 30s cache + concurrency 6 + 429/502 retry + `X-Device-Id`, 401 logout) | CANONICAL (with 3 justified exceptions §3.4) |
| Auth | `core/auth.py` + `core/dependencies.py` (`CurrentUser/CurrentUserId/DbClient`) + `repositories/users` + `repositories/password` | CANONICAL (legacy bridges documented, keep) |
| Cache | `core/cache.py` (`cached`, `CACHE_TTL_SHORT/MEDIUM/LONG`, Redis/LRU) + `request.js` GET cache | OPTIMIZATION-ONLY (DB wins — needs invariant doc) |
| API contracts | `schemas/*` Pydantic (23 files) + `api/router.py` registry | CANDIDATE (needs per-concept dedup §6) |
| Design tokens | `website/src/styles/tokens.css` + `themes/dark.css` (ADR 0022) | CANONICAL |
| State frontend | **Split**: server (apiRequest cache) vs `authStorage.js` vs `firebase.js` session vs 30+ direct `localStorage` keys vs `usePersistentState` (under-used) | VIOLATED (§7) |
| Logging | Backend `logging.getLogger` (e.g. `main.py`) vs frontend scattered `console.warn/error/log` (updaters, request.js prod warnings, sockets) | NO SINGLE STRATEGY |
| Tests | `server/tests/{unit,api,services,e2e}` + `conftest/support` (SQLite, real tokens, scripted AI) · `website/src/lib/__tests__` + `utils/__tests__` | CANONICAL harness, coverage TBD Phase 9 |

---

## 3. Duplicate implementations (KEEP ONE → migrate → delete)

### 3.1 Data access ×2 (highest value, highest care)
- `repositories/` (24): `jobs.py JobRepository`, `projects.py ProjectRepository`, `calls.py CallRepository`, `notifications.py NotificationRepository`, `eve_schedules.py EveScheduleRepository` (class style) vs `todos/documents/contacts/users/eve/eve_sessions/whatsapp/workspace_files` (function style) + `helpers.py` (soft-delete/snapshot) + `pagination.py` (facade over core + `user_collection/serialize_dates/paginate_collection` with raw `HTTPException(400)` inside — layering violation).
- `db/sql/` (21): per-entity `get_*_doc/set_*_doc/delete_*_doc/query_*` (67 matches, e.g. `todos/calls/contacts/documents/eve/hackathons/jobs/notifications/projects/users/whatsapp/user_sessions/settings/fallback`) + `base.py` + `client.py` (`get_db_client/get_firestore` dual names) + `query.py` (`SqlQuery/SqlSnapshot/SqlBatch`) + `registry.py` dispatch + `_shared.py` (`coerce_model_value/clean_data/json_safe` repeated per file) + `compat.py` + `fallback.py` in-memory store.
- Evidence: `services/eve/*`, `services/whatsapp.py`, `core/worker.py` import `repositories`; `repositories/*` import `db.sql`; `core/auth.py:262` imports `db.sql.user_sessions` directly (bypass).
- **Canonical**: `repositories/*` sole public API; `db/sql/*` internal driver; forbid `routes|services → app.db.sql` direct imports (Grep gate); `repositories/pagination.py` becomes pure re-export of `core/pagination.py` (+ `user_collection` stays only if no core equivalent).

### 3.2 Error handling (mechanical win)
- `core/errors.py` used by **5 files only**: `eve_avatar`, `modeling`, `auth/sessions`, `studio/_shared`, `ui_preferences`.
- Raw `raise HTTPException` in `ai_models(3)`, `contacts(5)`, `calls(4)`, `cron`, `auth/oauth(6)`, `auth/account(2)`, `auth/combine(9)`, `auth/credentials(7)`, `auth/password(16)`, `calls_twilio(4)`, `email(12)`, `documents(5)`, `eve(13)`, `gmail(7)`, `github/google_calendar/google_contacts`, `eve_speech`, `google_drive`, + `core/auth.py` itself.
- **Canonical**: `core/errors.py` only. Codemod preserves codes/messages 1:1 (strict preservation).

### 3.3 Configuration (scattered env/URLs)
- Backend: `main.py:65-67` serverless detection duplicates `config.py:141`; `main.py:191-195` `UPDATES_DIR/STATIC_UPDATES_DIR` bypasses `settings.updates_dir`; prod guards read `settings` (good) but detection doesn't.
- Frontend: `request.js:3` vs `googleContacts.js:4` vs `googleMail.js:7` (own `BACKEND_API_URL` + same localhost default) vs `utils/popupOAuth.js:56` (`import.meta.env.VITE_API_URL`) vs `PreviewPane.jsx:8-10` URL resolution.
- Env files: `server/.env` + `server/.env.example` + `.env.docker.example` + `.env.prod` (root) — document which is canonical per target; **never delete secrets** (AGENTS §1.3).
- **Canonical**: backend `settings.*` only; frontend `API_URL` from `request.js` only.

### 3.4 API clients (mostly canonical, 3 exception classes)
- Canonical `apiRequest` used by ~30 lib files. Raw `fetch`:
  (a) `googleContacts.js:9,23,36` + `googleMail.js` (OAuth authorize/accounts/import — needs `window.open`/non-JSON popup flow, justified per AGENTS §4.5-2 but must reuse `API_URL`);
  (b) `modelingApi.js:76` binary download (cannot use JSON parser — justified, keep with comment);
  (c) `updatesApi.js:10,19,25,31` public no-auth updater endpoints (uses `API_URL` correctly, `authRequired:false` alternative exists — normalize or document why native fetch);
  (d) `eveApi.js:76,181` SSE stream + `eveSpeechStream.js:15` MediaSource stream (justified binary/streaming exception);
  (e) `eveSpeechApi.js` correctly uses `fetchWithTimeout` from `request.js` — keep as pattern.
- **Canonical**: `apiRequest` + `fetchWithTimeout` from `request.js`; only (a)(b)(d) stay raw with inline justification.

### 3.5 Sockets (copy-paste)
- `callsSocket.js:19-32` `buildWsUrl` ≡ `whatsappSocket.js:8-19` `buildWsUrl` (http→ws + strip `/api/v1` + `window.location` fallback) + same backoff constants (`500/30_000/×2`) + same subscribe/connect/disconnect/visibility pattern (173 vs 165 lines, only path `/ws/calls` vs `/ws/whatsapp` + `send/pong` differ).
- **Canonical**: NEW `lib/wsClient.js` (`getWsBase()` + `createWsClient(path)`) or at minimum `getWsBase()` in `request.js`; both sockets reuse it.

### 3.6 Updaters (overlap)
- `updatesApi.js` (public check/latest/android/ota + `getAppVersion`) + `desktopUpdater.js` (Tauri flag/arch/check-silent/interactive/plugin) + `androidUpdater.js` + `otaUpdater.js` (same silent-check shape, DEV-only `console.warn`).
- **Canonical**: keep `updatesApi.js` as transport; extract shared silent-check guard (`checking` flag + DEV log) if identical; keep Tauri vs Capacitor branches.

### 3.7 Auth legacy bridges (keep, document — NOT tech debt to delete)
- `core/auth.py:247` legacy stateless fallback · `repositories/password.py:19,36` `hex` vs `hex$iterations` · `auth/credentials.py:126` 100k→600k rehash · `ai_models.py:39-50` + `unified_models.py:19-35` **identical** legacy `api_key→api_keys[provider]` migration (true duplicate → extract to `services/ai_models/config.load_ai_preference` helper or `_shared`).
- **Canonical**: single `_extract_user_keys` helper; keep fallbacks (auth safety).

### 3.8 AI catalog routes (naming overlap, verify intent)
- `routes/ai_models.py` (`/settings/ai-models`, PUT preference + per-provider models) vs `routes/unified_models.py` (`/models`, aggregated discovery + `free_only/modalities/tts/stt/provider` filters). Different prefixes (settings vs discovery) so possibly intentional; duplicate is only the legacy-key block + `has_server_key/provider_catalog` wiring.
- **Action Phase 2**: side-by-side read + ADR: keep both with clarified ownership OR merge `/{provider}` single-provider endpoints.

### 3.9 Storage/state keys (30+ literals, no index)
- 99 `localStorage|sessionStorage` hits: theme (`App.jsx:206,218` + `Header.jsx:125,138,186` + `themeApplicator.js:268,274` + `useThemeCustomizer.js:13,19,88,101,109,117,123,171`), avatar (`useAvatarPref` + `EveGlobalCompanion:26,42` + `AvatarOverlayManager:19` + `AvatarOverlayPage:12,97` duplicate `OVERLAY_POSITION_KEY`), workspace (`useWorkspace.js:12,26` active-id + `WorkspaceBrowser.jsx:13,21` per-workspace URL), studio (`BuilderChat:26,34` session + `studioBrief.js:5,13,15` session brief), calendar/hackathon focus keys (`CalendarPage:32,41`, `HackathonsPage:75,83`), dashboard (`dashboardConfig:172`, `DashboardPage:230`), search recents (`AdvancedSearchModal:39,121,131`), Gmail (`firebase.js` session map + local flag), OTA (`otaUpdater:18,41,51`), updater dismiss (`useAutoUpdater:12,60`), `useWorkspaceData:52,59,71,85,232` imported ICS + platforms, `CodingSection:45,105`, `EveUiBanner:56`, `useCustomUI:69,99,161`.
- `usePersistentState.js` (18 lines, correct pattern) used ~nowhere vs direct `getItem/setItem` everywhere.
- **Canonical**: NEW `lib/storageKeys.js` (or `utils/storageKeys.js`) + `usePersistentState` only; server wins on conflict.

### 3.10 CSS/architecture (already Wave A–F split, residual risk)
- Prior splits done (settings/themes/landing-auth/header/eve/calls/workspace/projects/studio/jobs/mails/whatsapp/chats/contacts/calendar/dashboard/cinema). Residual: verify `Grep :\s*#[0-9a-fA-F]` in component/page CSS per §4.6.2-5 + `!important`/inline-style audit in Phase 4.

### 3.11 Scripts/infra (multiplicity, do not delete pipeline blindly)
- `scripts/`: `build-{android,desktop,ota,all}.ps1+.sh` (8) + `lib/` + `enable-https/init-letsencrypt` + `pc-build-*` (5) + `vm-*` (5 incl. `vm-quick-fix.sh` — name violates §1.9, rename or document).
- `docker-compose.yml` + `docker-compose.backend.yml` + `docker-compose.ghcr.yml` + `docker-compose.ghcr.backend.yml` (4) — needs ownership table (local vs GHCR vs backend-only).
- `vercel.json` cron `*/15` + `nginx/` rate-limit/Gzip + `server/Dockerfile` + `website/Dockerfile` — keep, document.

---

## 4. Conflicting implementations (document, do NOT silently change)

1. **Errors**: `status.HTTP_404_NOT_FOUND` vs raw `404` vs `400` vs `422` for same "not found/validation" class (e.g. `eve.py:309 limit must be 1..20` is 400 while `ai_models` validation is 422). Preserve codes in codemod.
2. **Pagination**: `core/pagination` simple `encode(id)` vs `repositories/pagination.paginate_collection` Firestore-style `where deleted==False + order_by + start_after + limit+1 + Python re-filter` + `todos.py:29` "legacy list capped to 100" + `repositories/pagination.py:24` legacy-store fallback. Preserve wire shape; unify behind facade.
3. **Serverless detection**: `main.py:65-67` vs `config.py:141` — same envs, two sites. Unify to `settings.is_serverless` (add property, no new env).
4. **API_URL defaults**: three identical localhost fallbacks — unify to one import (no URL change).
5. **Theme init**: `App.jsx` vs `Header.jsx` vs `themeApplicator.js` vs `useThemeCustomizer.js` (`prefersDarkTheme`, stored `starwaves.theme`, pre-paint class). Unify read order, preserve stored prefs.
6. **Cache TTLs**: `core/cache CACHE_TTL_* (30/60/300)` vs `request.js (30s default, 120s prefs, 60s auth/ai-models, 15s usage/eve, 0 sessions)` vs `todos.py _TODOS_PREFIX` manual invalidate vs `usage:summary SHORT 30s` vs Eve RAG 30s/`MAX_INJECTED_MEMORIES=15`/`_session_cache` 5min (context §6). Document "DB wins" invariant; don't retune in refactor.

---

## 5. Dead code (candidates — verify usage before delete, Phase 8)

- **Server root (untracked, likely one-off scripts)**: `server/gen_memories.py`, `server/write_memories.py` (untracked per `git status`; if one-off backfills, move to `server/scripts/` or delete after confirming no imports).
- **Logs/caches (untracked or regenerable, never commit)**: `server/uvicorn.*.log`, `server/.pytest_cache`, `.pytest_cache/`, `server/.ruff_cache`, `__pycache__/`, `server/.venv/`, `starwaves.db` (root) + `server/starwaves.db`, `workspaces/` local data. Action: gitignore, not "refactor".
- **Secrets (DO NOT DELETE)**: `server/.env`, `.env.prod`, `server/firebase-secrets-opensync.json` — never stage/delete per AGENTS §1.3.
- **Deploy scripts**: audit `vm-quick-fix.sh`, `pc-*`, `vm-*` for live use; rename `quick-fix` (violates §1.9 language) or document as runbook.
- **Frontend fixtures**: `public/avatars/` examples (10MB VRM + 3MB Live2D per context) — allowed only as isolated dev fixtures, never imported by prod pages (verify).
- **Compat layers**: `db/compat.py`, `db/sql/fallback.py` in-memory, `db/sql/_shared.py` aliases (`_HACKATHON_COLUMN_ALIASES`, Firestore key map) — keep until callers migrated, then delete.
- **ADR numbering**: `0034-avatar-modeling-studio-projects.md` + `0034-avatar-studio-zoom-fix.md` collision + README index out-of-order (`0025` after `0021`, `0022` after `0029`, `0023/0024` after `0031`). Fix numbering/index in docs-only commit (never reuse numbers; rename second `0034` → next free `0043`).

---

## 6. Technical debt

1. **Oversized files** (AGENTS limit ~400, hard 500):
   Backend max is `services/whatsapp.py:549` (only >500) + `db/session.py:385`, `services/ui_preferences.py:381`, `routes/google_chat.py:363`, `routes/eve.py:333`, `repositories/whatsapp.py:329`, `models/__init__.py:328` (monolith — split into `models/*.py` package with facade, Phase 6), `services/web_browsing.py:326`, `ai_models/openai_compat.py:322`, `db/sql/eve.py:309`, `repositories/workspace_files.py:305`, `services/coding_stats.py:303`.
   Frontend >400 (19 files): `SceneViewport:560`, `useEveVoice:521` (known deferred exception — real-time audio, needs call QA), `VrmModel:506`, `App.jsx:506`, `EveVoiceSection:493`, `WhatsAppPage:483`, `DashboardPage:471`, `EveAssistantModal:462`, `ThemesPage:458`, `HackathonsPage:448`, `EvePage:440`, `ModelingStudioWorkspace:437`, `Header:432`, `AdvancedSearchModal:431`, `DocumentsPage:417`, `ChatsPage:417`, `ProjectDetailPage:414`, `Live2DModel:412`, `EveComposer:404`, `WorkspacePage:403`, `UsagePage:400`. Split per §3.3 facade pattern (new package + barrel re-export), largest-first after canonicals.
2. **No singletons**: logger, storage-keys, date/time, WS-base, updater-guard (see §3).
3. **Mixed repo styles** (class vs function) + `paginate_collection` doing HTTP (imports FastAPI inside repo) — move `HTTPException(400)` to route via `core/errors.bad_request`.
4. **RLS**: `SET LOCAL app.current_user_id` wired into `sql/base.py` only (verify coverage for `user_sessions`/raw paths in Phase 5).
5. **Frontend bundle**: size advisory (context §7) — keep manualChunks (`avatar-3d/avatar-live2d`, vendor/monaco/grid) as-is; no new deps without approval (§7.5).

---

## 7. Risky areas (extra tests + manual smoke before/after)

- Auth/session/devices (`itsdangerous` + `user_sessions` 30d/10-cap LRU + `X-Device-Id` + `session_revoked/sync_invalidate` + RLS) — ownership isolation tests required.
- Eve pipeline (multi-provider fallback ADR 0014 + `openai_compat` function-nesting + SSE `delta/thinking/tool/done` + RAG + background auto-remember + quota retry) — scripted-AI tests only, never live keys.
- WhatsApp (Go worker pairing + chats cursor pagination ADR 0042 + background sync + Eve auto-reply/draft/summarize) — dirty tree area; rebase carefully.
- Workspace files sync + modeling FS (`MODELING_ASSET_MAX_BYTES` 100MB, non-serverless FS) — path-traversal/ownership checks.
- OAuth (Google/GitHub/Drive/Gmail/Chat/Contacts deep-link `com.starwaves.app://` + state) + CORS allowlist + canonical domain 308 (ADR 0006).
- Cron/worker (Vercel `*/15` + `CRON_SECRET` + `ServerBackgroundWorker` — never run both; `is_serverless` gate).
- Cache invalidation (todos prefix, ai-config, usage, RAG, session) — stale-UX vs thundering-herd tradeoff; preserve TTLs.

---

## 8. Proposed canonical implementations (ratify in Phase 2 ADRs)

```text
DATABASE ............ sql/schema.sql + models/__init__.py mirror (read-only)
RUNTIME DATA ........ repositories/* ONLY (db/sql/* internal; Grem gate: no routes|services → app.db.sql)
PAGINATION .......... core/pagination.py (repositories/pagination.py → facade re-export)
ERRORS .............. core/errors.py (codemod all raise HTTPException → helpers, same codes)
CONFIG (BE) ......... core/config.py Settings + settings.is_serverless (remove main.py os.getenv bypass)
CONFIG (FE) ......... lib/request.js API_URL (+ NEW lib/storageKeys.js for all localStorage/sessionStorage keys)
API CLIENT .......... lib/request.js apiRequest + fetchWithTimeout (raw fetch only: OAuth popup, binary, SSE/MediaSource — inline justification)
WS .................. NEW lib/wsClient.js getWsBase() + createWsClient() (callsSocket + whatsappSocket reuse)
AUTH ................ core/auth.py + core/dependencies.py + repositories/users + repositories/password
AI KEYS ............. services/ai_models/config.load_ai_preference + single _extract_user_keys helper
UPDATES ............. lib/updatesApi.js transport + thin platform shims
STATE ............... SERVER (apiRequest useCache) / UI (usePersistentState + storageKeys) / DERIVED (useMemo) / CACHE (mirror, DB wins)
LOGGING ............. NEW lib/logger.js (DEV-gated) + backend logging (no raw console in prod paths)
TOKENS/CSS .......... styles/tokens.css + themes/dark.css (ADR 0022, already canonical)
TESTS ............... server/tests/* (pytest asyncio_mode=auto) + website npm test (no weakened assertions)
```

---

## 9. Files that should be merged

| Keep | Merge into it | Notes |
|---|---|---|
| `core/pagination.py` | `repositories/pagination.py` → facade | Remove `HTTPException` from repo helper |
| `core/errors.py` | all `routes/*.py` raw raises | Same codes/messages |
| `core/config.py` (+ new `is_serverless`) | `main.py:65-67,191-195` bypass | No new env vars |
| `lib/request.js` (`API_URL`, `fetchWithTimeout`, + new `getWsBase`) | `googleContacts.js:4`, `googleMail.js:7`, `popupOAuth.js:56`, `callsSocket:23-24`, `whatsappSocket:10-11`, `PreviewPane:8-10` | Same URLs |
| `services/ai_models/config` helper | `ai_models.py:39-50` + `unified_models.py:19-35` legacy-key blocks | One `_extract_user_keys` |
| `lib/updatesApi.js` | `desktopUpdater/androidUpdater/otaUpdater` shared guard | Keep platform branches |
| `lib/storageKeys.js` (NEW) + `usePersistentState` | 30+ direct key literals (§3.9) | Server wins |
| `models/*.py` package (NEW, facade in `__init__.py`) | `models/__init__.py:328` monolith | Preserve import path |
| `lib/wsClient.js` (NEW) | `callsSocket.js` + `whatsappSocket.js` | Same backoff/visibility |

---

## 10. Files that should be deleted (only after migration + green tests; never secrets)

- `server/gen_memories.py`, `server/write_memories.py` (if one-off; else move to `server/scripts/`).
- `server/uvicorn.*.log`, `.pytest_cache/`, `__pycache__/`, `server/.ruff_cache/` (untracked hygiene; gitignore).
- `db/compat.py` / `db/sql/fallback.py` / legacy alias maps (after callers on repositories-only).
- `repositories/pagination.paginate_collection` body (after facade; keep re-export during migration, then remove if unused).
- Second `0034` ADR filename collision (rename to `0043-*`, fix README index order).
- `scripts/vm-quick-fix.sh` name (rename to runbook name; content preserved) — violates §1.9 language.

## 11. Files that should be moved

- `server/gen_memories.py`, `write_memories.py`, `make_ico.py` (root-level one-offs) → `server/scripts/` with README purpose line, or delete per §10.
- Per-entity SQLAlchemy models out of `models/__init__.py` → `models/user.py`, `job.py`, `project.py`, … + `__init__.py` facade (preserve `from app.models import User`).
- New `website/src/lib/storageKeys.js`, `website/src/lib/wsClient.js`, `website/src/lib/logger.js` (singletons; no `utils2/helpers2` sprawl).
- `docs/adr/0034-avatar-studio-zoom-fix.md` → `0043-*` (fix collision).

---

## 12. Refactoring order (Phases 2–11; Phase 1 = this file)

```text
PHASE 2 — Canonicals (ADRs 0044+: data-access single-layer, errors-only, config-singleton, storage-keys, ws-base, updaters, ai_models-route ownership; update docs/adr/README.md)
PHASE 3 — Remove duplicates (errors codemod → pagination facade → config bypass → ai_models legacy-key helper → coerce/json_safe shared)
PHASE 4 — Centralize configuration (settings.is_serverless, API_URL/storageKeys, document env-file ownership; Grep: os.getenv outside config, VITE_API_URL outside request.js)
PHASE 5 — Centralize business rules (routes thin validate→delegate→respond; move HTTP out of repositories; RLS coverage check; NO semantic change — document oddities)
PHASE 6 — Normalize API contracts (one Pydantic per concept; models/ split with facade; preserve wire shapes)
PHASE 7 — Normalize state (SERVER/UI/DERIVED/CACHE; theme/avatar/workspace/studio keys; DB-wins invariant)
PHASE 8 — Remove dead code (§10; Grep unused exports/imports; no "just in case")
PHASE 9 — Tests (update affected; add success/validation/ownership/edge for merged rules; BUILD+TYPECHECK+LINT+TEST per phase)
PHASE 10 — Docs (ARCHITECTURE.md + PROJECT_MAP.md + AGENTS.md hard rules + context.md one-liner <15k; old detail → CHANGELOG.md)
PHASE 11 — Final verification + REFACTOR_REPORT.md (Removed/Merged/Moved/Canonicals/Ownership/API/DB(none)/Tests/Debt/Risks/Final Arch + §18 checklist) → git status/add/commit/push
```

Per-phase gates: `website/ npm run lint && npm run build`, `server/ python -m pytest tests -q`, `Grep demo|mockData|placeholder|fakeData|lorem` clean, `Grep temp fix|easy fix|quick fix|hack|workaround` clean, bare-color `Grep` clean, files <400 (500 hard), `context.md` one-liner, ADR+code same commit, no sub-agents, no secrets staged.
