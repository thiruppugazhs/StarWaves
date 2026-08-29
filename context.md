# Starwaves Context

Living snapshot for AI agents. `AGENTS.md` holds permanent rules; this file holds the **current state**. See `CHANGELOG.md` for history and `PROJECT_MAP.md` for the file index.

Last updated: 2026-08-27 — B+C+E multi-device: user_sessions (jti/did, per-device revoke, 10 cap) + calls WS multi (ring all devices, BroadcastChannel) + device-aware auth + sync_invalidate WS + DeviceSection settings

## Contents
1. [Overview](#1-overview) · 2. [Repository structure](#2-repository-structure) · 3. [Backend](#3-backend) · 4. [Frontend](#4-frontend) · 5. [Design system](#5-design-system) · 6. [Current snapshot](#6-current-snapshot) · 7. [Limitations](#7-limitations) · 8. [Verification](#8-verification)

## 1. Overview
Personal productivity workspace: projects, jobs, tasks, documents, code workspace, calendars, email, WhatsApp, hackathons, competitive programming, and EVE AI assistant.

- **Frontend** (`/website`): React 19 + Vite + Vanilla CSS (monochrome) + Monaco Editor. Docker multi-stage + Nginx.
- **Backend** (`/server`): FastAPI + Supabase PostgreSQL 16 + pgvector + Async SQLAlchemy 2.0.
- **Desktop** (`/website/src-tauri`): Tauri v2 scaffold.
- **Worker** (`/services/whatsapp-worker`): Go (WhatsMeow) bridge.
- **Auth:** Bearer `itsdangerous` tokens + Google OAuth. Deploy targets Vercel (serverless) or Docker VM.

## 2. Repository structure
```text
starwaves/
├── website/            React 19 + Vite (monochrome, Monaco, lucide-react, Framer Motion)
├── server/             FastAPI backend (app/api, app/core, app/db/sql, models, repos, schemas, services)
├── services/whatsapp-worker/  Go bridge
├── sql/                extensions.sql, schema.sql (16 tables), migrations.sql, indexes.sql (incl. HNSW)
├── nginx/              reverse proxy (5r/s limit_req on /api & /ws, 20M cap, Gzip)
├── PROJECT_MAP.md      Compact index for agents — read first
├── context.md          This file — current snapshot
├── CHANGELOG.md        History log
├── AGENTS.md           Permanent agent rules
└── opencode.json       Preloads AGENTS.md + PROJECT_MAP.md via instructions
```
For full maps see `PROJECT_MAP.md`. Keep this section brief; expand there.

## 3. Backend
- **Factory:** `server/app/main.py` `create_app()` — lifespan (CORS, `/api/v1` router, `/ws/calls`, `/ws/whatsapp`, `ServerBackgroundWorker`).
- **Worker:** `core/worker.py` `ServerBackgroundWorker` (Docker) + Vercel Cron `vercel.json` → `/api/v1/cron/execute-schedules` every 15m (serverless). Verify `CRON_SECRET`.
- **Prefix:** `/api/v1`. Auth via `core/auth.py`. Errors via `core/errors.py`. Pagination via `core/pagination.py` (cursor `created_at,id` + `limit+1`).
- **Layering:** Routes → Services/Repos → Core/Models. Never import FastAPI types in Services/Repos. Use `CurrentUser`/`CurrentUserId`/`DbClient` from `core/dependencies.py`.
- **Route groups:** `auth/` (oauth/credentials/password/account/combine/sessions), `workspace/` (jobs/hackathons/projects/notifications/contests/calendar), `whatsapp/` (status/chats/messages/settings/webhook+`_shared`), `workspace_files`, `whatsapp_ws`+`calls_ws`+`twilio-relay`, `eve`+`eve_stream` (SSE), `calls`+`calls_twilio`, `ai_models`, `eve_speech`, `ui_preferences` (`/ui/preferences` tokens/CSS/visibility/history + `GET /history`), `cron`, `health`.
- **Repos:** one per entity (`helpers.py` soft-delete/snapshot, `pagination.py` facade). **Services:** `eve/` (chat/stream/tools/handlers/memories/RAG + `ui` tools), `ui_preferences` (per-user `ui-preferences` doc, `users/{uid}/settings/ui-preferences` v1, sanitize CSS, allowlist tokens, history 20), `ai_models/` (contracts/catalog/config/discovery/loop + adapters), `speech/` (Groq/Deepgram STT, Google/OpenRouter TTS), `twilio/`, `oauth/`, `web_browsing/`, `embeddings` (text-embedding-3-small 1536-dim).
- **DB:** `models/` (`UserSession` for devices) + mixins. SQL in `sql/` (idempotent, now `user_sessions` + indexes `ix_user_sessions_*`). `db/sql/` modular handlers + `registry.py` dispatch + `base.py` CRUD + RLS `SET LOCAL app.current_user_id`. Device sessions 30d expiry, 10 cap LRU.
- **Performance:** hot reads `async+to_thread`, composite indexes (`ix_*_user_deleted_created`, `ix_calls_status_updated`), pools `5/5 recycle 300`, Redis/LRU `core/cache.py` (`CACHE_TTL_SHORT=30`/`MEDIUM=60`/`LONG=300`, `cached` decorator with per-user `prefix:user_id:hash` keys, Pydantic-aware `cache_set`, `cache_invalidate_prefix` + `cache_clear` + autouse test fixture), workspace disk `WORKSPACE_STORAGE_PATH`.

## 4. Frontend
- **Entry:** `website/src/main.jsx` → `App.jsx` (routing + workspace state). **Layout:** `layouts/AppLayout.jsx`.
- **UI primitives** `components/ui/` (`Modal`, `MailModal`, `ConfirmDialog`, `PageHeader`, `EmptyState`, `CustomDropdown`, `CalendarPicker`, `Markdown`, `TabNav`, `SectionHeading`, `SettingsCard`, `MetricCard`, `SearchBar`, `Pagination`, `FilterBar`, `Alert`, `LoadingState`, `Avatar`, `Badge`, `EveUiBanner`) — must reuse before creating ad-hoc.
- **Hooks:** `hooks/` (`useAuth` + storage/BroadcastChannel sync, `useRouter`, `useThemeCustomizer`, `useWorkspaceData`, `useCustomUI`, `useDevices`, `useSyncEvents`, `call/` `useWebRTC`/`useEveVoice`/`useCallCenter` (multi-device ring, BroadcastChannel)) + `usePersistentState`.
- **API clients** `lib/` — one per backend feature, all via `request.js` `apiRequest` (dedup + 30s cache + 429/502 retry + `X-Device-Id/Name`, 401 auto-logout). `authApi.js` now device-aware (`getDeviceId/Name`, sessions CRUD), `useDevices`, `uiPreferencesApi`, `firebase.js`.
- **Pages:** Dashboard, Projects, ProjectDetail, Jobs, Hackathons, Todo, Documents, Workspace (IDE + Eve + Browser), Studio (hero → builder/apps/templates), Eve (chat+memory+voice+schedules), Calls (WebRTC+Twilio, E: ring all), WhatsApp, Mails, Calendar, Contacts, CompetitiveCoding, Stats, Settings (`DeviceSection` + `AppearanceSection` + `AccountSection`), `CustomPage`, Themes, Profile, Onboarding, Landing, etc.
- **Config:** `config/navigation.js`, `config/search/` (7 modules), `dashboard/dashboardConfig.js`, `themes/` 22 presets, `utils/` pure transformers, `styles/` tokens→base→utilities→responsive→components (`eve-ui.css`, `device-section.css`)→pages→`layout-symmetry.css`.
- **Performance:** lazy heavy pages, Vite `manualChunks` (vendor/firebase/monaco/grid), `request.js` dedup/cache.

## 5. Design system
- **Monochrome only:** `#000/#09090b/#121212/#18181b`, `#fff/#fafafa/#f4f4f5`, grays `#27272a/#3f3f46/#71717a/#e4e4e7`. No red/blue/green/yellow/purple/gradients.
- **Tokens first:** `styles/tokens.css` CSS vars (8pt scale `--space-3xs`→`--space-3xl`, `--content-max-width` 1440, `--content-gutter` clamp, `--section-gap` clamp, `--card-padding` clamp, `--header-height` 68/62, `--sidebar-collapsed/expanded`). Import order `tokens→base→utilities→responsive→components→pages→layout-symmetry` via `App.css`.
- **One CSS per component/page**, `kebab-case` classes scoped (`studio-prompt-attachment-chip`), use vars (`var(--radius-lg)`), dark overrides in `styles/themes/dark.css`.
- **Full-page, no clip:** `min-height:100vh` accounting for chrome, natural scroll. Responsive mobile-first with `clamp()`. Geometry now single-source in `layout-symmetry.css` (centered `max-width:1440` + symmetric `content-gutter` + `safe-area` insets; fullscreen exceptions for Workspace/WhatsApp/Studio/Eve).
- Icons `lucide-react` only.

## 6. Current snapshot
- Simple GET caching: `core/cache.py` `cached(ttl,prefix)` wraps all hot-read GETs (`/todos`, `/contacts`, `/documents`, `/profiles`, `/workspace/projects|jobs|notifications`, `/eve/sessions|memories`, `/settings/*`, `/usage/*`, `/auth/me`, `/calls/*`, `/eve/schedules`, `/ui/preferences`, `/settings/eve-memory`) with `prefix:user_id:hash` keys and `cache_invalidate_prefix` on POST/PATCH/PUT/DELETE/restore; Redis SETEX when `REDIS_URL` else local LRU-1000; `tests/support/db.py` + `tests/conftest.py` autouse `cache_clear` for isolation.
- Multi-device B+C+E: `user_sessions` (device_id/name, jti, expires 30d, 10 cap) via `create_session_token` (X-Device-Id/Name) + `GET/PATCH/DELETE /auth/sessions` + `POST /revoke-others` + WS `session_revoked`/`sync_invalidate` (`whatsapp_ws_manager` multi) + `request.js` 401→`starwaves:session-revoked` + `useAuth` storage/BroadcastChannel + `DeviceSection` settings + `useSyncEvents` (invalidate → `workspaceRefreshKey`) + `todos`/`workspace_files` broadcast.
- Workspace IDE folder-first + Monaco tabs/breadcrumb + Explorer + Eve Agent SSE panel (`useEveAgentChat.js`, `workspace_id` required on file tools, now also dispatches `eve-ui-update` for UI tools) + Browser side panel (`htmlContent` srcdoc, `initialUrl`, `starwaves.workspace.browser-url:{id}`).
- Studio: `StudioHero` (Add files picker + attachment chips + `studioBrief.js` brief) → builder fixed-viewport IDE; hero `flex:1` full-bleed; `StudioAppsPage` lists `build_status: ready` apps.
- EVE: multi-provider (OpenAI/Anthropic/Gemini/OpenRouter/Ollama/OpenCode) with live `/v1/models` discovery; `stream_chat_with_eve` SSE (`delta/tool_start/tool_end/done/error+[DONE]`); pgvector RAG (top-5, HNSW `ix_eve_memories_embedding`, fallback 40 recent); auto-remember (capped 3, deduped, toggle `users/{uid}/settings/eve-memory`); tools: `read/write/list/search/run` workspace files (require `workspace_id`), web `browse/search/fetch`, WhatsApp, `open_workspace_browser`, schedule (`create/list/delete`), UI (`get_ui_state`/`update_ui_theme`/`update_ui_styles`/`manage_ui_visibility`/`reset_ui`/`list_ui_history`/`create_custom_page` → `ui-preferences` + `apply_ui_overrides`/`reset_ui`/`open_custom_page` actions + `eve-ui-update` event + `useCustomUI` + `EveUiBanner`), `QuestionCard` plan UI, `ModelSelectorDropdown` with key filtering; `eve/chat_context` shared resolver.
- Voice: dual path — `voice_fast.py` Groq `llama-3.1-8b-instant` sentence-chunked TTS + `POST /eve/voice/stream` + `streamEveVoice` queue + Twilio `ConversationRelay` `/ws/twilio-relay` (~0.7–1.2s); STT: browser/Groq Whisper/Deepgram `nova-3` via `POST /eve/transcribe`; TTS: browser/Google Cloud/OpenRouter Fish `s2.1-pro-free` via `POST /eve/synthesize`; Settings `eve-speech` catalog with fallback.
- Calls: `in_app` (WebRTC) vs Twilio PSTN (`TWILIO_*`, `provider/external_sid/phone_number`, `useCallCenter dial(provider,phone)` + barge-in). **Multi:** `CallWSManager policy=multi`, ringing broadcasts to all devices, `handleCallEvent` active→teardown incoming on other devices, `BroadcastChannel('starwaves-call')` per-tab sync.
- Search: `⌘K` palette across pages/settings/Eve/records/actions with pills + keyboard nav.
- Landing: sharp Linear cinema (`LandingPage.jsx` 87L + 8 Framer Motion sections + `cinema.css` scoped 373L, fixed dark #000).
- Security: RLS `SET LOCAL` via `set_rls_user` in `sql/base` generic handlers, `starwaves_app` role, `SECURITY.md`, rate-limit 5r/s, `pickle→json`, CORS allowlist, `realpath`, `DOMPurify`, pip `no-build-isolation` + npm `--ignore-scripts`, UI CSS sanitized (blocks `@import`/`javascript:`/external `url`/`< >`) + allowlisted tokens + history-capped 20.
- Infra: compose lean e2-micro (pgvector 128M, redis 96M, server 512M), Nginx 5r/s + Gzip, Vercel cron `/cron/execute-schedules`.

## 7. Limitations
- Calendar create/edit not implemented. Mail attachments/forwarding/rich-text/drafts not implemented. Calls use STUN only — TURN needed for strict NAT. Frontend bundle emits size advisory.

## 8. Verification
```text
# Frontend (website/)
npm run lint && npm run build && npm test
# Backend (server/)
python -m pytest tests -q
# Docker
docker compose config && curl -i http://localhost/health
```
Tests: pytest `asyncio_mode=auto`, harness `tests/support/` (SQLite, real tokens, scripted AI providers), `tests/{unit,api,services,e2e}` — mocks only external (AI/HTTP/Twilio/WhatsApp).
