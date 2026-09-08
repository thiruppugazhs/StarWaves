# PROJECT_MAP.md

> **Agent fast-path (read this first — 0 tool calls via `opencode.json` `instructions`).** This is the file index. Use the tables below to locate 1–2 target files, then `Grep` with `include` and `Read` only those. Do **not** `Glob **/*` or scan the tree. For current implementation state see `context.md` (Tier 2, conditional); for history see `CHANGELOG.md`.

---

## Top-Level Structure

```text
starwaves/
├── website/          React 19 + Vite frontend (monochrome + spectrum design system)
├── server/           FastAPI Python backend (SQLAlchemy 2.0 + PostgreSQL)
├── services/         Microservices
│   └── whatsapp-worker/   Go (WhatsMeow) WhatsApp bridge
├── nginx/            Reverse proxy config
├── sql/              Canonical DB schema + migrations + indexes
├── docs/adr/         Architecture Decision Records (0001, _template, README)
├── AGENTS.md         Permanent agent rules (no sub-agents, context.md, ADRs)
├── context.md        Living project snapshot (current state only)
├── CHANGELOG.md      History log (moved from context.md)
├── PROJECT_MAP.md    This file — agent fast-path index
├── opencode.json     Preloads AGENTS.md + PROJECT_MAP.md via instructions
└── docker-compose.yml
```

---

## Frontend (`website/`)

**Stack**: React 19, Vite, Vanilla CSS (monochrome + spectrum tokens), Monaco Editor, lucide-react, Framer Motion

### Key Directories

| Path | Purpose |
|------|---------|
| `src/components/ui/` | Shared primitives: Modal, Badge, PageHeader, EmptyState, CustomDropdown, FilterBar, SearchBar, Pagination, etc. |
| `src/components/calls/` | CallScreen, IncomingCallOverlay |
| `src/components/whatsapp/` | WhatsAppChatList, WhatsAppConversation (→ `conversation/` package), WhatsAppQrModal, WhatsAppInfoDrawer |
| `src/hooks/` | useAuth, useRouter, useThemeCustomizer, useWorkspaceData, usePersistentState |
| `src/hooks/call/` | callConstants, callHelpers, useWebRTC, useEveVoice, useCallCenter |
| `src/lib/` | API clients — one per backend feature, all via `request.js` (`apiRequest`) |
| `src/pages/` | Route-level components (see Page Map below) |
| `src/pages/settings/` | Settings sections: Profile, AiModels, EveVoice, WhatsApp, Gmail, Github, etc. |
| `src/pages/studio/` | StudioHero, StudioAppsPage, StudioBuilderPage, StudioTemplatesPage |
| `src/pages/workspace/` | WorkspacePage + IDE components (editor, browser, eve panel) |
| `src/pages/landing/` | Cinematic landing (Framer Motion sections, scoped cinema.css) |
| `src/styles/` | tokens.css, base.css, components/, pages/, themes/ |
| `src/themes/` | 25 presets (10 mono + 12 duo + 3 spectrum) + engine |
| `src/config/` | navigation.js, search/ package |
| `src/utils/` | Pure transformers (speech, calendar, projectLifecycle, fileSize) |
| `src-tauri/` | Tauri v2 desktop shell scaffold |

### Page Map

| Route | Page | Notes |
|-------|------|-------|
| `/` | Dashboard | Grid layout via dashboardConfig |
| `/projects` | ProjectsPage | → `projects/` package |
| `/projects/:id` | ProjectDetail | Lifecycle phases |
| `/jobs` | JobsPage | Application timeline chart |
| `/hackathons` | HackathonsPage | Sources + manual entry |
| `/documents` | DocumentsPage | Monaco editor |
| `/todos` | TodoPage | Tasks with checkboxes |
| `/workspace` | WorkspacePage | Code IDE + Eve Agent panel + Browser |
| `/studio` | StudioProjectsPage | Hero prompt → builder |
| `/studio-apps` | StudioAppsPage | In-progress + finished apps |
| `/studio/:id` | StudioBuilderPage | Eve builder IDE |
| `/studio-templates` | StudioTemplatesPage | Curated templates |
| `/eve` | EvePage | AI chat + memory + voice + schedules |
| `/calls` | CallsPage | WebRTC + Twilio PSTN |
| `/whatsapp` | WhatsApp | Chat list + conversation |
| `/mails` | MailsPage | Gmail integration |
| `/calendar` | CalendarPage | Google Calendar |
| `/contacts` | ContactsPage | → `contacts/` package |
| `/chats` | ChatsPage | Chat interface |
| `/competitive-coding` | CompetitiveCoding | Contests + profile |
| `/stats` | StatsPage | Coding stats |
| `/settings` | SettingsPage | → `settings/` sections |
| `/themes` | ThemesPage | Theme customizer |
| `/profile` | ProfilePage | User profile |

### API Clients (`src/lib/`)

One file per backend feature, all use `apiRequest()` from `request.js`:

| Client | Backend Feature |
|--------|----------------|
| `eveApi.js` | EVE chat, streaming, memories, voice, schedules |
| `callsApi.js` | Calls (in-app + Twilio) |
| `callsSocket.js` | `/ws/calls` WebSocket |
| `whatsappApi.js` | WhatsApp CRUD |
| `whatsappSocket.js` | `/ws/whatsapp` WebSocket |
| `workspaceFilesApi.js` | Workspace file operations |
| `workspaceApi/` | Jobs, projects, hackathons, notifications, contests, calendar |
| `todosApi.js` | Todos |
| `documentsApi.js` | Documents |
| `contactsApi.js` | Contacts |
| `gmailApi.js` | Gmail |
| `googleCalendar.js` | Google Calendar |
| `googleContacts.js` | Google Contacts |
| `googleDriveApi.js` | Google Drive |
| `githubApi.js` | GitHub |
| `aiModelsApi.js` | AI provider/model settings |
| `eveSpeechApi.js` | STT/TTS provider settings |

---

## Backend (`server/`)

**Stack**: FastAPI (Python 3.12), SQLAlchemy 2.0 (async), Supabase/PostgreSQL 16, Redis

### Directory Structure

```text
server/app/
├── api/
│   ├── router.py              Central route registry
│   └── routes/                HTTP endpoints
│       ├── auth/              oauth, credentials, password, account, combine
│       ├── workspace/         jobs, hackathons, projects, notifications, contests, calendar
│       ├── whatsapp/          status, chats, messages, settings, webhook + _shared
│       ├── eve.py             Non-streaming chat
│       ├── eve_stream.py      SSE streaming chat
│       ├── calls.py           WebRTC in-app
│       ├── calls_twilio.py    PSTN via Twilio
│       ├── calls_ws.py        /ws/calls WebSocket
│       ├── whatsapp_ws.py     /ws/whatsapp WebSocket
│       ├── workspace_files.py File CRUD + sync
│       ├── ai_models.py       Provider/model settings
│       ├── eve_speech.py      STT/TTS settings
│       └── cron.py            Vercel cron endpoint
├── core/                      Shared infrastructure
│   ├── config.py              Settings dataclass (env vars)
│   ├── auth.py                Token creation/validation
│   ├── errors.py              HTTP error helpers
│   ├── http.py                httpx client factories
│   ├── dependencies.py        DI aliases (CurrentUser, DbClient)
│   ├── pagination.py          Cursor-based pagination
│   ├── cache.py               Redis/LRU abstraction
│   ├── worker.py              Background daemon
│   ├── rls.py                 Row-level security
│   └── ws/                    WebSocket base + facades
├── db/
│   ├── session.py             Engine, session, init_db
│   └── sql/                   Entity handlers + registry + base CRUD
├── models/                    SQLAlchemy models + mixins
├── repositories/              Data access (one per entity)
├── schemas/                   Pydantic request/response
├── services/                  Business logic
│   ├── eve/                   AI assistant (chat, stream, tools, handlers, memories)
│   ├── ai_models/             Multi-provider AI engine
│   ├── speech/                STT/TTS providers
│   ├── twilio/                PSTN integration
│   ├── whatsapp/              WhatsApp session + messaging
│   ├── oauth/                 OAuth helpers (google, github)
│   ├── web_browsing/          DuckDuckGo + page extraction
│   └── embeddings.py          OpenAI text-embedding-3-small
└── tests/                     pytest suite (unit/api/services/e2e)
```

### Layered Architecture

```
Routes → Services OR Repositories (not both for same op)
Services → Repositories, Core
Repositories → Core, Models
Core → nothing (foundation)
```

### Key Route Groups

| Group | Module | Key Endpoints |
|-------|--------|---------------|
| Auth | `routes/auth/` | `/auth/signup`, `/auth/login`, `/auth/google/*`, `/auth/merge-accounts` |
| EVE | `routes/eve.py` + `eve_stream.py` | `POST /eve/chat`, `POST /eve/chat/stream` (SSE) |
| Calls | `routes/calls.py` + `calls_twilio.py` | `/calls/incoming`, `/calls/trigger-eve`, `/calls/twilio`, `/calls/twilio/gather` |
| WhatsApp | `routes/whatsapp/` | `/whatsapp/status`, `/whatsapp/chats`, `/whatsapp/send`, `/whatsapp/webhook` |
| Workspace Files | `routes/workspace_files.py` | `/workspace-files/workspaces`, `/workspace-files/tree`, `/workspace-files/sync` |
| Settings | `routes/ai_models.py` + `eve_speech.py` | `/settings/ai-models`, `/settings/eve-speech` |

### Key Repositories

| Repository | Entity |
|------------|--------|
| `users.py` | User accounts |
| `projects.py` | Projects (with lifecycle phases) |
| `jobs.py` | Job applications |
| `todos.py` | Tasks |
| `documents.py` | Documents |
| `contacts.py` | Address book |
| `calls.py` | Call records |
| `eve.py` + `eve_sessions.py` | EVE memories + chat sessions |
| `workspace_files.py` | Workspace file metadata |
| `whatsapp.py` | WhatsApp messages/chats |

### Key Services

| Service | Purpose |
|---------|---------|
| `eve/` | AI chat orchestrator, streaming, tool dispatch, memory RAG, auto-remember |
| `ai_models/` | Multi-provider engine (OpenAI, Anthropic, Gemini, Ollama, OpenRouter, OpenCode) |
| `speech/` | STT (Groq Whisper) + TTS (Google Cloud, OpenRouter Fish) |
| `twilio/` | PSTN call initiation + TwiML |
| `whatsapp/` | Session pairing, message dispatch, Eve auto-reply |
| `web_browsing/` | DuckDuckGo search + page extraction |
| `embeddings.py` | OpenAI text-embedding-3-small (1536-dim) for memory RAG |

---

## Database (`sql/`)

| File | Purpose |
|------|---------|
| `extensions.sql` | pgvector extension |
| `schema.sql` | 18 CREATE TABLE statements (incl. `user_sessions`, `ai_usage`) |
| `migrations.sql` | Idempotent ALTER TABLE backfills |
| `indexes.sql` | Performance composites + HNSW vector index |

Key tables: `users`, `projects`, `jobs`, `todos`, `documents`, `contacts`, `calls`, `eve_memories`, `eve_sessions`, `whatsapp_chats`, `whatsapp_messages`, `workspace_files`, `notifications`, `hackathons`, `profiles`, `user_sessions`, `ai_usage` (+ `user_settings`/`workspace_files` etc.)

---

## Services (`services/`)

| Service | Purpose |
|---------|---------|
| `whatsapp-worker/` | Go WhatsMeow bridge — multi-device pairing, chat/message sync, webhooks |

---

## Infrastructure

| Component | Details |
|-----------|---------|
| `docker-compose.yml` | pgvector (128M), Redis (96M), server (512M), workspace-data, whatsapp-data |
| `nginx/` | Reverse proxy: 5r/s rate limit, Gzip, 20MB cap, security headers |
| `website/Dockerfile` | Multi-stage Node.js build + Nginx SPA |
| `server/Dockerfile` | Python 3.12-slim + Uvicorn |
| `vercel.json` | SPA rewrites `((?!api/).*)` + cron `*/15 * * * *` → `/api/v1/cron/execute-schedules` |

---

## Auth Architecture

- Bearer `itsdangerous` tokens (via `core/auth.py`)
- Google OAuth via `services/oauth/google.py`
- DI aliases: `CurrentUser`, `CurrentUserId`, `DbClient` (via `core/dependencies.py`)
- RLS: `SET LOCAL app.current_user_id` via `core/rls.py`

---

## Development Commands

```text
# Frontend (from website/)
npm run lint        # Oxlint
npm run build       # Production build
npm test            # Vitest

# Backend (from server/)
python -m pytest tests -q   # unit + api + services + e2e

# Docker (from root)
docker compose up --build -d
curl -i http://localhost/health
```

---

## Docs & ADRs (`docs/`)

| Path | Purpose |
|------|---------|
| `docs/adr/README.md` | ADR index + rules (numbering, lifecycle, commit gate) |
| `docs/adr/_template.md` | ADR template (Status, Context, Decision, Consequences, Alternatives) |
| `docs/adr/0001-*.md` | ADR 0001 — No sub-agents, context.md first, ADRs required |

ADRs: `docs/adr/NNNN-kebab-case-title.md` (zero-padded, sequential). Create via `_template.md`; commit with code; update `context.md` `Last updated`.

## Agent Rules (`AGENTS.md` §1)

- **No sub-agents** (§1.6): Direct execution only — never delegate via `Task`/sub-agents. Use `Grep` (with `include`) + `Read` on 1–2 files from `PROJECT_MAP.md`, `Bash`/`Edit`/`Write` directly; `TodoWrite` for large work.
- **Tiered loading** (§1.5): Tier 0 `AGENTS.md`+`PROJECT_MAP.md` (preloaded) → Tier 1 `PROJECT_MAP.md` → Tier 2 `context.md` (conditional) → Tier 3 targeted `Grep`/`Read`. No `Glob **/*` scans.
- **context.md** (§1.1): Living snapshot <15k, updated in same commit as code (single `Last updated` one-liner; old detail → `CHANGELOG.md`).
- **ADRs required** (§1.7): Non-trivial architecture → ADR in `docs/adr/` with lifecycle `Proposed→Accepted→Superseded`.

## Files to Ignore

```text
.git/  node_modules/  dist/  build/  .next/  coverage/  .cache/  vendor/
server/.env  server/.env.prod  website/.env
__pycache__/  *.pyc  .DS_Store
server/tests/support/  # Test scaffolding only
```
