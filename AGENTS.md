# AGENTS.md

Instructions and guidelines for AI Coding Agents working in the **Starwaves** codebase.

> **CRITICAL MANDATE FOR ALL AI AGENTS:**
> Read this document thoroughly before writing, editing, or refactoring any code in this repository.

---

## 🛑 1. Core Principles & Communication

1. **Maintain `context.md` as the Living Snapshot** (keep it < 15k / ~4k tokens):
   - `context.md` at the repository root is the authoritative **current state**
     of the codebase — read it via the tiered protocol in §1.5, not by brute force.
   - After any change that alters the implementation — new routes, pages,
     components, repositories, services, scripts, dependencies, environment
     variables, features, or architecture — **update `context.md` to match** in
     the same change (single `Last updated` one-liner; move old detail to `CHANGELOG.md`).
   - Update the **`Last updated`** date at the top of `context.md` whenever you
     modify it. Keep it to **one line** (`2026-08-27 — summary`), not a wall of `Also` blocks.
   - Remove or amend entries that are no longer true (features, routes, files,
     scripts, limitations). Never leave `context.md` describing the old state and never exceed **15k chars** — compact proactively.

5. **Tiered Context Loading — Never Reread All Files**:
   - Tier 0 (preloaded, 0 tool calls): `opencode.json` `instructions` already injects `AGENTS.md` + `PROJECT_MAP.md` into the system prompt. Do not re-read them with tools unless you need a fresh copy.
   - Tier 1 (1 read, ~3k tokens): Start with `PROJECT_MAP.md` for navigation — it is the file index (route map, client map, directory map). Use it to locate 1–2 target files.
   - Tier 2 (conditional, ~4k tokens): Read `context.md` only when the task is cross-cutting, needs infra/architecture state, or `PROJECT_MAP.md` is insufficient.
   - Tier 3 (targeted): Use `Grep` with `include` filters (`*.py`, `*.jsx`, `*.css`) and `Read` on specific paths from Tier 1. **Prohibited:** `Glob **/*` without `include`, full tree scans, or reading every file to orient. Prefer semantic `Grep` over enumeration.
   - `CHANGELOG.md` holds history — never read it for orientation; `context.md` history belongs there.

2. **Ask When in Doubt**:
   - Never guess user intent, business logic, API schemas, or ambiguous design
     decisions.
   - If a requirement is unclear or underspecified, **ask the user for
     clarification** before executing changes.

3. **Prohibition on Deleting Secrets**:
   - **NEVER** delete, clear, wipe, or remove secrets, API keys, credentials,
     `.env` files, service account JSON files, or sensitive environment
     variables under any circumstances.
   - If secret rotation or refactoring is required, request explicit user
     guidance.

4. **Respect System Architecture**:
   - **Frontend (`/website`)**: React 19 + Vite + Vanilla CSS (Monochrome
     Design System) + Monaco Editor.
   - **Backend (`/server`)**: FastAPI (Python) + Supabase (PostgreSQL) / Async
     SQLAlchemy 2.0.
   - **Desktop Shell** (`/website/src-tauri`): Tauri v2 scaffold.
   - **WhatsApp Worker** (`/services/whatsapp-worker`): Go (WhatsMeow) bridge.
   - Never introduce a new framework, ORM, CSS preprocessor, or bundler
     without explicit user approval.

---

## 🏗 2. Clean Code Principles

### 2.1 Fundamentals

| Principle | Rule |
|-----------|------|
| **DRY** | Avoid code and style duplication. Extract reusable helpers, hooks, and UI components. |
| **KISS** | Keep implementation simple, readable, and direct. Avoid premature optimization. |
| **YAGNI** | Do not build features, abstractions, or flexibility "just in case". Implement only what is needed right now. |
| **SRP** | Each component, module, or function has exactly one well-defined responsibility. |
| **LoD (Law of Demeter)** | A module should only talk to its direct collaborators; never reach deep into nested structures (e.g. `user.settings.eve.memory.enabled`). |
| **Fail Fast** | Validate inputs at the boundary (route handler / component prop); raise or return early on invalid state. |
| **Explicit > Implicit** | Prefer named exports, explicit imports, typed props, and named constants over implicit defaults. |

### 2.2 Naming Conventions

| Context | Convention | Examples |
|---------|-----------|----------|
| React Components | `PascalCase` | `ProjectFormModal`, `WhatsAppMessageBubble` |
| Component Files | `PascalCase.jsx` | `StudioHero.jsx`, `EveVoiceSection.jsx` |
| Hooks | `camelCase`, prefixed `use` | `useWorkspaceData`, `useEveVoice` |
| Hook Files | `camelCase.js` | `useProjectFilters.js`, `useCallCenter.js` |
| API Clients (`/lib`) | `camelCase` suffixed `Api`/`Socket` | `todosApi.js`, `callsSocket.js` |
| JS Utils / Constants | `camelCase.js` | `projectLifecycle.js`, `fileSize.js` |
| CSS Files | `kebab-case.css` | `filter-pills.css`, `layout-symmetry.css` |
| CSS Classes | `kebab-case` | `.studio-prompt-attachment-chip` |
| CSS Variables | `--kebab-case` | `--bg-primary`, `--radius-md` |
| Python Modules | `snake_case.py` | `workspace_files.py`, `chat_stream.py` |
| Python Classes | `PascalCase` | `ServerBackgroundWorker`, `BaseWSManager` |
| Python Functions/Vars | `snake_case` | `resolve_ai_config`, `build_memory_instructions` |
| Python Constants | `UPPER_SNAKE_CASE` | `MAX_TOOL_ROUNDS`, `GET_CACHE_TTL_MS` |
| Database Tables/Columns | `snake_case` | `eve_memories`, `build_status` |
| Environment Variables | `UPPER_SNAKE_CASE` | `OPENAI_API_KEY`, `WORKSPACE_STORAGE_PATH` |
| URL Paths | `kebab-case` | `/workspace-files/sync`, `/eve/chat/stream` |

### 2.3 Code Hygiene

- **Self-Documenting Code**: Use clear, descriptive names for variables,
  functions, and files. Avoid cryptic abbreviations. If a name needs "and" to
  describe it, the unit does too much — split it.
- **No Dead Code**: Do not leave commented-out code, unused imports, or unused
  variables in the codebase. Remove them immediately.
- **No Magic Values**: Extract hardcoded numbers, string constants, and API
  URLs into named constants or configuration settings.
  ```python
  # ❌ Bad
  if len(memories) > 100:

  # ✅ Good
  MAX_RECENT_MEMORIES = 100
  if len(memories) > MAX_RECENT_MEMORIES:
  ```
- **Explicit Error Handling**: Handle errors gracefully and explicitly. Never
  swallow exceptions silently or return fake/dummy data to mask issues.
  ```python
  # ❌ Bad — silently eats the error
  try: result = await fetch_data()
  except: pass

  # ✅ Good — logs and re-raises or returns a meaningful error
  try:
      result = await fetch_data()
  except httpx.HTTPError as exc:
      logger.error("fetch_data failed: %s", exc)
      raise service_unavailable("Upstream service is unreachable.")
  ```
- **Boy Scout Rule**: Always leave the codebase cleaner than you found it.
  Refactor small code smells encountered while working on a feature.
- **Guard Clauses Over Deep Nesting**: Prefer early-return guard clauses.
  ```javascript
  // ❌ Bad
  function handleSubmit(data) {
    if (data) {
      if (data.name) {
        // ...20 lines of logic
      }
    }
  }

  // ✅ Good
  function handleSubmit(data) {
    if (!data?.name) return
    // ...20 lines of logic
  }
  ```

---

## 📐 3. Modular Design — File & Function Structure

### 3.1 One File = One Feature

Every file must represent **exactly one feature or one responsibility**. Do not
mix unrelated features into a single file.

**When a module grows beyond its feature**, split it into a package where each
sub-module owns one feature and the package entry point (`__init__.py` /
`index.js` / `index.jsx`) only re-exports a combined public API.

**Examples of valid feature groupings**:

| Layer | Package | Files |
|-------|---------|-------|
| Backend routes | `app/api/routes/auth/` | `oauth.py`, `credentials.py`, `password.py`, `account.py`, `combine.py`, `_shared.py` |
| Backend routes | `app/api/routes/whatsapp/` | `status.py`, `chats.py`, `messages.py`, `settings.py`, `webhook.py`, `_shared.py` |
| Frontend pages | `src/pages/settings/` | `ProfileSection.jsx`, `GmailSection.jsx`, `WhatsAppSection.jsx`, … (page shell only composes them) |
| Frontend components | `src/components/whatsapp/conversation/` | `WhatsAppConversationHeader.jsx`, `WhatsAppMessagesFeed.jsx`, `WhatsAppMessageBubble.jsx`, `WhatsAppComposer.jsx`, `WhatsAppModals.jsx`, `utils.js`, hooks |

**Shared helpers** may live in a `_shared.py` / `index.js` / `constants.js`
within the feature package so they are not duplicated across files.

**Never** create a `utils/` / `misc/` dumping ground for unrelated logic; route
each helper to the feature that owns it.

### 3.2 One Function = One Thing

- Each function must do **one thing** and be named for that thing.
- A function that branches on mode flags (e.g. `if (mode === 'reset') ... else
  ...`) or dispatches across unrelated behaviors must be split into dedicated
  handlers (e.g. `handleAuthSubmit` / `handleResetSubmit`).
- A single dispatcher that routes to many unrelated operations should be
  replaced by per-feature handlers that each live next to their feature.
- If a function's name needs "and" to describe it, split it.

### 3.3 Large File Refactor — Split Oversized Modules

- No file should exceed **~400 lines** (hard limit **500**); anything larger is
  a candidate for immediate refactor.
- When a file exceeds the limit, split it into a package where each sub-module
  owns one feature and the **original import path is preserved** as a thin
  facade re-exporting the public API.

  ```text
  # Backend example
  server/app/services/eve.py (900 lines) →
  server/app/services/eve/
  ├── __init__.py          # facade: from .chat import chat_with_eve; ...
  ├── constants.py
  ├── instructions.py
  ├── chat.py
  ├── chat_stream.py
  ├── chat_context.py
  ├── dispatcher.py
  ├── memories.py
  ├── tools/               # per-domain tool catalogs
  └── handlers/            # per-domain tool handlers

  # Frontend example
  WhatsAppConversation.jsx (700 lines) →
  conversation/
  ├── index.jsx            # facade: export { WhatsAppConversation }
  ├── WhatsAppConversationHeader.jsx
  ├── WhatsAppMessagesFeed.jsx
  ├── WhatsAppMessageBubble.jsx
  ├── WhatsAppComposer.jsx
  ├── WhatsAppModals.jsx
  ├── utils.js
  └── hooks/
  ```

- Keep the original import path working via the facade so callers need no
  changes.
- Each new module must itself satisfy **One File = One Feature** and **One
  Function = One Thing** and stay under the line limit.
- Prefer `constants.py`/`constants.js`, per-domain `tools/` and `handlers/`,
  and dedicated hooks (`useWebRTC`, `useEveVoice`, `useProjectFilters`) over a
  catch-all `utils` file.
- Verify after splitting: `npm run lint` / `npm run build` (frontend),
  `python -m pytest tests -q` (backend). Update `context.md`.

---

## 🎨 4. Frontend Architecture (`/website`)

### 4.1 Technology & Stack

| Concern | Technology |
|---------|-----------|
| Framework | React 19 (functional components + hooks only) |
| Bundler | Vite |
| Styling | Vanilla CSS with design tokens (no Tailwind, no CSS-in-JS, no SCSS) |
| Editor | Monaco Editor (embedded in Workspace & Studio) |
| Icons | `lucide-react` only — no other icon libraries |
| Desktop | Tauri v2 (`/website/src-tauri`) |

### 4.2 Directory Conventions

```text
website/src/
├── components/      # Shared, reusable UI components
│   ├── ui/          # Design system primitives (Modal, Badge, PageHeader, …)
│   ├── calls/       # Call-specific components (CallScreen, IncomingCallOverlay)
│   └── whatsapp/    # WhatsApp-specific components
├── hooks/           # Global reusable hooks (useAuth, useRouter, useWorkspaceData)
│   └── call/        # Call sub-hooks (useWebRTC, useEveVoice, callConstants)
├── lib/             # API client modules — one per backend feature
│   └── workspaceApi/# Split by feature when API surface grows
├── config/          # Static configuration (navigation, search index)
│   └── search/      # Search index split by category
├── pages/           # Route-level page components
│   ├── settings/    # Feature sections composed by the Settings page shell
│   ├── workspace/   # Workspace IDE sub-components
│   ├── studio/      # Studio sub-pages (hero, apps, builder, templates)
│   ├── projects/    # Project feature package
│   ├── contacts/    # Contact feature package
│   └── landing/     # Landing page cinema sections
├── layouts/         # Layout shells (AppLayout)
├── styles/          # All CSS
│   ├── tokens.css   # Design tokens (typography, radii, shadows, transitions)
│   ├── base.css     # Element-level resets & defaults
│   ├── utilities.css
│   ├── responsive.css
│   ├── layout-symmetry.css  # Final geometry pass
│   ├── themes/      # Light/dark + preset theme overrides
│   ├── components/  # Component-level styles (one .css per component)
│   └── pages/       # Page-level styles (one .css per page)
├── themes/          # Theme presets, options, engine
├── utils/           # Pure data transformers/parsers (no side effects)
└── dashboard/       # Dashboard grid layout config
```

### 4.3 Component Rules

1. **Functional Components Only**: Never use class components. All components
   are functional with hooks for state and effects.

2. **Reuse UI Primitives**: Always check `components/ui/` first. The following
   primitives exist and **must** be used instead of creating ad-hoc replacements:

   | Primitive | Use For |
   |-----------|---------|
   | `Modal` | Portal-based dialogs (Escape + backdrop dismiss, focus management) |
   | `MailModal` | Full-page-style mail/detail modals |
   | `ConfirmDialog` | Destructive confirmation prompts |
   | `PageHeader` | Page title + action buttons |
   | `EmptyState` | Zero-data placeholder with icon + CTA |
   | `FormField` | Labeled form input wrappers |
   | `CustomDropdown` | Styled select/dropdown menus |
   | `CalendarPicker` | Date selection |
   | `TabNav` | Tab navigation within a page |
   | `SectionHeading` | Section titles with optional action |
   | `SettingsCard` / `SettingsSection` | Settings page cards |
   | `MetricCard` / `MetricGrid` | Stat display grids |
   | `SearchBar` | Search inputs with icon |
   | `Pagination` | Page navigation controls |
   | `FilterBar` / `FilterPills` | Filter selectors |
   | `Alert` | Info / warning / error banners |
   | `LoadingState` | Skeleton / spinner placeholders |
   | `Avatar` | User avatar with fallback |
   | `Badge` | Status / count badges |
   | `Markdown` | Rendered markdown content |

3. **Component Structure Pattern**:
   ```jsx
   // 1. Imports — React, hooks, components, API, icons, constants
   import { useState, useEffect } from 'react'
   import { PageHeader, EmptyState } from '../components/ui'
   import { fetchProjects } from '../lib/workspaceApi/projects'
   import { FolderOpen, Plus } from 'lucide-react'

   // 2. Constants (if any, co-located or imported from feature constants.js)
   const STATUS_OPTIONS = ['active', 'completed', 'archived']

   // 3. Component — single default or named export
   export function ProjectsPage() {
     // a. State
     // b. Effects
     // c. Handlers (each named for one action)
     // d. Early returns (loading, error, empty)
     // e. Render
   }
   ```

4. **No Inline Styles**: All styling goes through CSS classes and design tokens.
   Never use `style={{ ... }}` attributes for layout or visual styling. The only
   exception is truly dynamic values that cannot be expressed as CSS classes
   (e.g. `style={{ '--progress': `${percent}%` }}`).

5. **Props Over Flags**: Prefer composing small, focused components over passing
   mode/type flags that make one component do many things.
   ```jsx
   // ❌ Bad — one component with mode branching
   <Card mode="metric" />
   <Card mode="settings" />

   // ✅ Good — dedicated components
   <MetricCard />
   <SettingsCard />
   ```

### 4.4 Hook Rules

1. **Custom Hooks for Shared Logic**: Extract stateful logic that is used by 2+
   components into a custom hook under `src/hooks/`.
2. **Feature Hooks Co-located**: Hooks specific to a feature package live inside
   that package (e.g. `pages/projects/useProjectFilters.js`,
   `pages/contacts/useContacts.js`).
3. **Hook Naming**: Always prefix with `use`. The name should describe the data
   or capability, not the implementation (`useWorkspaceData`, not
   `useFirestoreQuery`).

### 4.5 API Client Rules (`/lib`)

1. **One File per Backend Feature**: Each API client module maps to one backend
   route group. Name it `<feature>Api.js`.
2. **All HTTP goes through `request.js`**: Use `apiRequest()` for every call.
   Never use raw `fetch()` directly in API clients — `apiRequest` handles auth
   tokens, deduplication, caching, retries, and timeouts.
3. **Named Exports**: Export individual functions, not a default object.
   ```javascript
   // ✅ Good
   export function fetchProjects(cursor, limit) { ... }
   export function createProject(data) { ... }

   // ❌ Bad
   export default { fetchProjects, createProject }
   ```
4. **When an API Surface Grows**: Split into a `<feature>Api/` package with one
   file per sub-resource and an `index.js` barrel re-export (see
   `workspaceApi/`).

### 4.6 CSS & Design System

#### 4.6.1 Strict Color Palette (Monochrome Only)

**ONLY Black & White** are allowed across the entire UI.

| Role | Allowed Values |
|------|---------------|
| Pure/Dark Black | `#000000`, `#09090b`, `#121212`, `#18181b` |
| Pure/Off White | `#ffffff`, `#fafafa`, `#f4f4f5` |
| Grayscale Accents / Borders | `#27272a`, `#3f3f46`, `#71717a`, `#e4e4e7` |

**PROHIBITED**: Red, blue, green, yellow, purple, gradient fills, or rainbow
themes are strictly forbidden. State indicators (status badges, active states)
must use high-contrast black/white or grays.

#### 4.6.2 CSS Architecture

1. **Design Tokens First**: All shared values live in `tokens.css` as CSS custom
   properties. Never hardcode pixel values, colors, or shadows that already
   exist as tokens.

2. **CSS Import Order** (defined in `App.css`):
   ```text
   tokens.css → base.css → utilities.css → responsive.css
   → components/*.css → pages/*.css → layout-symmetry.css (final pass)
   ```
   New component styles go in `styles/components/<name>.css`; new page styles go
   in `styles/pages/<name>.css`. Always add the `@import` in the correct section
   of `App.css`.

3. **One CSS File per Component/Page**: Do not put styles for multiple
   unrelated components in one CSS file.

4. **Use Token Variables**: Always reference design tokens over raw values.
   ```css
   /* ❌ Bad */
   .card { border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

   /* ✅ Good */
   .card { border-radius: var(--radius-lg); box-shadow: var(--shadow-md); }
   ```

5. **Class Naming**: Use `kebab-case`, scoped to the feature/component
   (e.g. `.studio-prompt-attachment-chip`, `.ws-overview-grid`). Never use
   generic class names that could collide (`.container`, `.wrapper`, `.card`
   without a prefix).

6. **Dark Mode**: Use CSS custom properties defined per theme. Dark overrides
   live in `styles/themes/dark.css`. Never branch in JS to apply dark styles.

#### 4.6.3 Full-Page Layout — Never Cut Off Content

- Every page must render as a **complete, full-height layout** where all content
  is fully visible and accessible — no clipped, truncated, or cut-off sections.
- Page containers must account for the full viewport height including fixed
  headers/footers (e.g. `min-height: 100vh` minus chrome, or flex layouts with
  `flex: 1` on the main content area).
- Long content must scroll naturally within its container; never use fixed
  heights or `overflow: hidden` on containers that would clip content.
- Verify pages at multiple viewport sizes (desktop, tablet, mobile). No
  unintended horizontal scrollbars.
- Before declaring a UI task complete, visually confirm that the entire page
  renders without truncation.

#### 4.6.4 Responsive Design

- Use the breakpoints and patterns established in `responsive.css`.
- Mobile-first approach: base styles target mobile, `@media` queries add
  desktop overrides.
- Use `clamp()` and `min()`/`max()` for fluid sizing aligned with token values
  (e.g. `--layout-gutter: clamp(16px, 3vw, 40px)`).
- Avoid pixel-perfect layouts that break on intermediate viewports.

---

## ⚙️ 5. Backend Architecture (`/server`)

### 5.1 Technology & Stack

| Concern | Technology |
|---------|-----------|
| Framework | FastAPI (Python 3.12) |
| Database | Supabase (PostgreSQL 16) + pgvector, Async SQLAlchemy 2.0 |
| Cache | Redis (VM) / LRU (serverless) via `core/cache.py` |
| Auth | Bearer `itsdangerous` tokens via `core/auth.py` |
| Background | `ServerBackgroundWorker` (Docker daemon) + Vercel Cron Jobs (serverless) |
| HTTP Client | `httpx` via `core/http.py` (`create_async_client` / `create_sync_client`) |

### 5.2 Layered Architecture

The backend follows a strict **4-layer architecture**. Each layer has a clear
boundary and dependency direction (top → bottom). **Never skip layers.**

```text
┌─────────────────────────────────────────┐
│  Routes (app/api/routes/)               │  ← HTTP boundary: parse request,
│  Thin controllers: validate, delegate,  │     validate, call service/repo,
│  serialize response.                    │     return response.
├─────────────────────────────────────────┤
│  Services (app/services/)               │  ← Business logic, orchestration,
│  External integrations, AI, email,      │     multi-repo coordination.
│  complex workflows.                     │     No HTTP/FastAPI imports.
├─────────────────────────────────────────┤
│  Repositories (app/repositories/)       │  ← Data access: CRUD, queries,
│  One per entity. Firestore/SQL calls    │     pagination, file storage.
│  live here only.                        │     No business logic.
├─────────────────────────────────────────┤
│  Core (app/core/) + Models + Schemas    │  ← Shared infrastructure: config,
│  Config, auth, errors, HTTP, pagination,│     auth, typed errors, DI aliases,
│  DI, WebSocket managers, cache.         │     request/response shapes.
└─────────────────────────────────────────┘
```

**Dependency Rules**:
- Routes → Services OR Repositories (not both for the same operation)
- Services → Repositories, Core
- Repositories → Core, Models
- Core → nothing (it is the foundation)
- **Never** import from Routes in Services/Repositories
- **Never** import FastAPI types (`Request`, `Response`, `HTTPException`) in
  Services or Repositories

### 5.3 Directory Conventions

```text
server/app/
├── api/
│   ├── router.py          # Central route registry
│   └── routes/            # HTTP endpoint modules
│       ├── auth/          # Auth package (oauth, credentials, password, account, combine)
│       ├── whatsapp/      # WhatsApp package (status, chats, messages, settings, webhook)
│       ├── workspace/     # Workspace data (jobs, hackathons, projects, notifications, contests, calendar)
│       ├── studio/        # Studio endpoints
│       └── *.py           # Single-file route modules
├── core/                  # Shared infrastructure
│   ├── config.py          # Environment-driven Settings dataclass
│   ├── auth.py            # Token creation/validation
│   ├── errors.py          # Reusable HTTP error helpers (not_found, bad_request, …)
│   ├── http.py            # Shared httpx client factories
│   ├── dependencies.py    # DI aliases (CurrentUser, CurrentUserId, DbClient)
│   ├── pagination.py      # Cursor-based pagination helpers
│   ├── cache.py           # Redis/LRU cache abstraction
│   ├── worker.py          # Background daemon for long-running server
│   └── ws/                # WebSocket manager base + facades
├── db/                    # Database engine, session, SQL handlers
│   └── sql/               # Entity-specific SQL handlers + registry
├── models/                # SQLAlchemy declarative models + mixins
├── repositories/          # Data access layer — one per entity
├── schemas/               # Pydantic request/response models
├── services/              # Business logic & external integrations
│   ├── ai_models/         # Multi-provider AI engine (contracts, catalog, config, discovery, loop, adapters)
│   ├── eve/               # EVE AI assistant (chat, streaming, tools, handlers, memories, context)
│   ├── oauth/             # OAuth helpers (google, github, _shared)
│   ├── speech/            # STT/TTS provider catalog & implementations
│   ├── twilio/            # Twilio PSTN integration
│   ├── studio/            # Studio builder services
│   └── *.py               # Single-file service modules
├── templates/             # Email HTML templates
└── tests/                 # Backend pytest suite (unit/api/services/e2e)
```

### 5.4 Route Handler Rules

1. **Thin Controllers**: Route handlers validate input, call a service or
   repository, and return a response. No business logic in routes.
   ```python
   # ✅ Good — thin route
   @router.post("/projects")
   async def create_project(data: CreateProjectRequest, user_id: CurrentUserId, db: DbClient):
       project = await project_repo.create(db, user_id, data.model_dump())
       return project

   # ❌ Bad — business logic in the route
   @router.post("/projects")
   async def create_project(data: CreateProjectRequest, user_id: CurrentUserId, db: DbClient):
       if data.status == "active" and data.phase in ("ship", "maintain"):
           data.status = "completed"  # business rule leaked into route
       # ...50 more lines of logic
   ```

2. **Use DI Aliases**: Always use `CurrentUser`, `CurrentUserId`, `DbClient`
   from `core/dependencies.py` instead of raw `Depends(get_current_user)`.

3. **Use Error Helpers**: Always use `core/errors.py` functions (`not_found`,
   `bad_request`, `unauthorized`, `forbidden`, `unprocessable`,
   `service_unavailable`, `bad_gateway`) instead of constructing `HTTPException`
   inline.
   ```python
   # ✅ Good
   from app.core.errors import not_found
   raise not_found("Project not found.")

   # ❌ Bad
   raise HTTPException(status_code=404, detail="Project not found.")
   ```

4. **Route Module When Split**: When a route group becomes a package, use a
   `_shared.py` for common helpers and `__init__.py` as a re-export facade.

### 5.5 Repository Rules

1. **One Repository per Entity**: Each entity (projects, jobs, todos, etc.) has
   its own repository file.
2. **Pure Data Access**: Repositories contain ONLY database queries, CRUD
   operations, and pagination. No HTTP calls, no business logic.
3. **Use Shared Helpers**: For soft-delete payloads, snapshot serialization, and
   pagination — use `repositories/helpers.py` and `core/pagination.py`.
4. **Consistent Naming**: Functions follow `get_*`, `create_*`, `update_*`,
   `delete_*`, `list_*`, `search_*` naming patterns.

### 5.6 Service Rules

1. **Business Logic Lives Here**: Orchestration, multi-step workflows, external
   API calls, AI model interactions, and multi-repo coordination.
2. **No FastAPI Imports**: Services must not import `Request`, `Response`,
   `HTTPException`, or any FastAPI-specific type.
3. **Use `core/http.py`**: For external HTTP calls, use `create_async_client()`
   or `create_sync_client()` — they share connection limits, timeouts, and
   User-Agent headers.
4. **When a Service Grows**: Split into a package following the `eve/` pattern:
   `constants.py`, per-domain `tools/` and `handlers/`, and an `__init__.py`
   facade.

### 5.7 Schema Rules

1. **Pydantic Models Only**: All API request/response shapes must be Pydantic
   models in `schemas/`.
2. **One Schema File per Route Group**: Mirror the route module structure.
3. **Strict Validation**: Use Pydantic validators for complex business rules
   (string lengths, enums, date ranges).

### 5.8 Database & Models

1. **Models in `models/`**: All SQLAlchemy declarative models live in
   `app/models/`. Use the provided mixins (`TimestampMixin`, `SoftDeleteMixin`,
   `UserOwnedMixin`) from `models/mixins.py`.
2. **Migrations**: Schema changes go in `sql/migrations.sql` (idempotent
   `ALTER TABLE IF NOT EXISTS` style). New tables go in `sql/schema.sql`.
3. **Indexes**: Performance-critical indexes go in `sql/indexes.sql` with
   descriptive names (`ix_<table>_<columns>`).

---

## ⚡ 6. Serverless & Background Worker Rules

1. **Vercel Cron Jobs for Serverless**: In serverless environments (Vercel /
   Cloud Functions), long-running persistent daemon threads or background
   workers are not supported. Use Vercel Cron Jobs in `vercel.json` targeting
   serverless API endpoints.

2. **Cron Job Configuration Template** (`vercel.json`):
   ```json
   {
     "crons": [
       {
         "path": "/api/v1/cron/process-jobs",
         "schedule": "0 * * * *"
       }
     ]
   }
   ```

3. **Endpoint Security**: Serverless cron endpoints must verify authorization
   (e.g. `CRON_SECRET` header checks) to prevent unauthorized execution.

4. **Docker Background Worker**: For self-hosted (Docker) deployments,
   `ServerBackgroundWorker` in `core/worker.py` runs as a daemon thread. It
   handles schedule execution, voice call triggering, and stale-call expiry.
   Never duplicate its responsibilities in cron endpoints — check
   `is_serverless` first.

---

## 🔀 7. Cross-Cutting Concerns

### 7.1 API Design

- **Prefix**: All backend routes live under `/api/v1`.
- **RESTful Verbs**: GET (read), POST (create/action), PUT (full update),
  PATCH (partial update), DELETE (remove).
- **Pagination**: Cursor-based with `cursor` & `limit` query params. Use
  `core/pagination.py` (`resolve_limit`, `encode_cursor`, `decode_cursor`,
  `PageResponse`).
- **Error Responses**: Always return `{ "detail": "Human-readable message." }`.
  Use `core/errors.py` helpers.
- **SSE Streaming**: For streaming endpoints (e.g. `/eve/chat/stream`), use
  `StreamingResponse` with `text/event-stream` content type and
  `X-Accel-Buffering: no` header.

### 7.2 State Management (Frontend)

- **No Global State Library**: State is managed via React hooks, context, and
  `localStorage` (`usePersistentState`).
- **API State**: Fetch in `useEffect`, store in component state. Use
  `apiRequest` with `useCache: true` for hot reads.
- **Cross-Component State**: Use React Context (via `useAuth`, `useRouter`,
  `useWorkspaceData`) or lift state to the nearest common ancestor.

### 7.3 Performance

| Layer | Rule |
|-------|------|
| Frontend | Lazy-load heavy pages (`Calendar`, `Eve`, `Workspace`, `WhatsApp`, `Calls`, `Chats`, `Mails`). Use Vite `manualChunks` for large deps (`vendor`, `firebase`, `monaco`, `grid`). |
| Frontend | `apiRequest` provides GET dedup + 30s cache + 429/502 retry. Use `useCache: true` for idempotent reads. |
| Backend | Hot reads use `async def` + `to_thread` for blocking DB calls. |
| Backend | Pagination: `WHERE deleted=false` + keyset `(created_at, id)` tie-breaker + `limit+1`. |
| Backend | Pools tuned for 1GB: `pool 5/5 recycle 300 timeout 30`. |
| Nginx | `limit_req 5r/s` on `/api/` and `/ws/`, 20M cap, Gzip. |

### 7.4 Security

- **Never commit**: `.env`, API keys, credentials, service account JSON, build
  artifacts, or `node_modules`.
- **Auth**: All mutating endpoints require `CurrentUser` / `CurrentUserId` DI.
- **CORS**: Origins validated via `_is_allowed_origin` (regex + allowlist) in
  exception handlers.
- **Input Validation**: Use Pydantic schemas for request bodies. Validate file
  sizes, path traversal, and resource ownership at the route level.
- **Cron Security**: All cron endpoints verify `CRON_SECRET`.

### 7.5 Imports & Dependencies

- **Frontend**: Use path-relative imports (`../components/ui`, `../../lib/eveApi`).
  No `@/` aliases. Barrel re-exports via `index.js` for packages.
- **Backend**: Use absolute imports from `app.` (`from app.core.errors import
  not_found`). Never use relative imports across packages.
- **New Dependencies**: Adding a new npm/pip package requires explicit user
  approval. Prefer existing solutions and standard library first.

---

## 🧪 8. Code Quality & Verification

### 8.1 Verification Before Completion

Never declare success without running build/lint/test tools to verify correctness:

| Layer | Commands |
|-------|----------|
| Frontend | `npm run lint` and `npm run build` in `/website` |
| Backend | `python -m pytest tests -q` in `/server` (unit + API + services + e2e; see §8.2) |
| Full | Verify Python syntax, test endpoints, check for import errors |

### 8.2 Testing Expectations

- **Framework**: Backend tests use **pytest** (`pytest.ini` at `server/`; `asyncio_mode = auto`). Fixtures live in `server/tests/conftest.py` and `server/tests/support/` (SQLite harness, real-token auth helpers, scripted AI providers, httpx MockTransport wiring).
- **Layout**: `tests/unit/` (pure logic), `tests/api/` (route tests), `tests/services/`, `tests/e2e/` (`@pytest.mark.e2e` journeys). The conftest blocks `.env` loading and points `DATABASE_URL` at a throwaway SQLite file — tests never touch the dev DB or real secrets.
- **Backend**: New features should include tests for success paths, validation errors, ownership isolation, and edge cases.
- **Frontend**: Build verification (`npm run build`) catches import errors, undefined references, and type issues.

### 8.3 Preserve Comments & API Contracts

- Maintain existing docstrings, API response shapes, and file structure
  integrity unless the change explicitly refactors them.

---

## 📦 9. Git & Deployment

### 9.1 Commit All Changes — No Exceptions

- Every change made during a task — code, docs, configuration, `context.md`
  updates, new or deleted files — **MUST be committed** before the task is
  considered complete.
- Never leave working-tree modifications uncommitted at the end of a task; run
  `git status` to confirm the tree is clean (only untracked/ignored files like
  `.env` may remain).
- Stage all intended files (`git add <files>`), never commit secrets, `.env`,
  credentials, or build artifacts.
- Use a clear, concise commit message that describes the change (not the task).

### 9.2 Always Push After Completion

- When a task is completed (code verified, `context.md` updated, files
  staged/committed), **push to the remote** so the repository stays in sync.
- Run `git status`, `git add <intended files>`, `git commit`, then `git push`
  to the current branch's upstream. Never force-push.
- If a push fails, report the exact error instead of silently leaving the
  remote behind.

### 9.3 Branch Hygiene

- Work on the current branch unless the user explicitly requests a new branch.
- Commit messages follow imperative mood: "Add project lifecycle phases", not
  "Added" or "Adding".

---

## 📋 Quick Reference Checklists

### Before Writing Code

- [ ] Read `context.md` for current state
- [ ] Check `components/ui/` for existing primitives
- [ ] Check existing hooks, API clients, and services for reusable logic
- [ ] Confirm the feature doesn't already exist elsewhere

### Before Committing

- [ ] `npm run lint` passes in `/website`
- [ ] `npm run build` succeeds in `/website`
- [ ] `python -m pytest tests -q` passes in `/server`
- [ ] No dead code, unused imports, or commented-out blocks
- [ ] No hardcoded magic values or inline styles
- [ ] File sizes are under 400 lines (500 hard limit)
- [ ] `context.md` updated if implementation changed
- [ ] No secrets, `.env`, or build artifacts staged
- [ ] Commit message is clear and imperative

### When Adding a New Feature

- [ ] Route handler is thin (validate → delegate → respond)
- [ ] Business logic lives in a service, not the route
- [ ] Data access lives in a repository, not the service
- [ ] Pydantic schema defined for request/response
- [ ] Frontend uses existing UI primitives
- [ ] API client uses `apiRequest()` from `request.js`
- [ ] CSS uses design tokens, not raw values
- [ ] Colors are monochrome only (black/white/gray)
- [ ] Tests added for new backend logic
- [ ] `context.md` updated with new routes/pages/features

