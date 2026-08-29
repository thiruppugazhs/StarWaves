# Changelog

Historical implementation log extracted from `context.md`. `context.md` now holds the **current snapshot** only; this file preserves the full chronological history for audit.

## 2026-08-26 — Security Phase 5 — RLS SET LOCAL + pip harden
- `core/rls.py` `set_rls_user` (SET LOCAL app.current_user_id) wired into `sql/base.py` generic handlers
- `studio/commands.py` hardened: `pip --no-build-isolation` + `npx/pnpm --ignore-scripts` + extended npm/yarn allowlist
- Prior phases in snapshot: BOLA per-entity owner+allowlist (11 collections), SSRF `0.0.0.0`/`is_unspecified`, `website/nginx.conf` HSTS/CSP, `twilio_relay` 4096 cap, Twilio hard enforce, docs prod-gate, worker HMAC, RLS `starwaves_app` role, `SECURITY.md`, rate-limit, `pickle→json`, CORS `*.vercel.app` removal, `realpath`, `DOMPurify`

## 2026-08-25 — Major passes (consolidated)

- **Firestore elimination:** Removed `google.cloud.firestore_v1`, `firebase_admin.firestore`, `FieldFilter` across 88+ backend files; unified on `SqlClient`/`DbClient`/SQLAlchemy 2.0; 137 tests pass.
- **Ollama default provider:** `DEFAULT_AI_PROVIDER=ollama`, `OLLAMA_URL=https://ollama.com/v1`, `OLLAMA_MODEL=gpt-oss:120b-cloud`; `DEFAULT_PROVIDER` reads `settings.default_ai_provider`; `has_server_key` checks `ollama_url`+`ollama_api_key`.
- **Ollama voice priority:** `voice_fast.resolve_voice_config` tries Ollama first → groq 8b-instant → gpt-4o-mini → user config.
- **Eve Memory page fix:** `.eve-active-view-container { overflow-y: auto }`, memories as compact horizontal list.
- **Mails connect one-page fit:** Refined `.mail-connect-hero-card` + features grid to fit viewport without scroll.
- **HTML live preview (Workspace):** `WorkspaceBrowser htmlContent` via `srcdoc` + `WorkspaceEditor onRunHtml` + `activeHtmlContent` derivation.
- **API-only model discovery:** Removed static fallback arrays in `catalog.py`/`discovery.py`; removed OpenAI prefix filter.
- **ModelSelectorDropdown + Plan Approval:** `ModelSelectorDropdown.jsx` filtering to keys + search; `studio-plan-inline-card` with Approve/Request Changes.
- **Workspace Eve → browser:** `open_workspace_browser` tool + `handlers/workspace_files` + `dispatcher` + `useEveAgentChat onAction` + `WorkspacePage handleEveAction`.
- **Studio planning questions:** `QuestionCard.jsx` + `questionUtils.js` with recommended pills + custom input.
- **Studio one-page layout:** Hero/prompts now true full-bleed flex fill, no phantom scroll.
- **Eve chat spacing fix:** Removed `min-height` gaps in `.eve-chat-section` / `.eve-messages-feed`.
- **Workspace card spacing fix:** `.ws-overview-grid` 320px min, 1240px max; `.ws-card-open` padding 20px.
- **Todo checkbox fix:** `.todo-check` 20px square with `aspect-ratio: 1/1`.
- **Talk-over barge-in:** `useEveVoice.interruptEve` + hold-to-talk cut + `CallRepository.update_status` terminal guard.
- **Studio hero Add files:** Removed `CreateProjectModal`, added `StudioHero` multi-file picker + `studioBrief.js` sessionStorage brief + `utils/fileSize.js` dedupe.
- **Studio builder fixed-viewport:** `.content:has(.studio-builder)` flex fill + rail `overflow-x: hidden`.
- **Workspace Eve Agent SSE:** `useEveAgentChat.js` hook + workspace_id required on 5 file tools + auto-refresh file tree.
- **Studio hero phantom-scroll fix:** Hero `flex:1` inside flex-filled content.
- **Twilio ConversationRelay:** `POST /calls/twilio` + `/trigger-eve-twilio` + `relay-twiml/{id}` + `/ws/twilio-relay` streaming groq 8b-instant with barge-in.
- **Flat inputs:** Removed `--shadow-inset` from inputs/selects/textareas; fixed browser URL input sizing.
- **Lovable hero, Deepgram STT, Workspace browser, Studio Apps** — prior rewrites (see git log for full diffs).

*(Prior entries before 2026-08-25 are in git history: `git log --oneline`.)*

---
*Generated: 2026-08-27 from former `context.md` history block. New changes go to `context.md` `Last updated` one-liner.*
