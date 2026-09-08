# Changelog

Historical implementation log extracted from `context.md`. `context.md` now holds the **current snapshot** only; this file preserves the full chronological history for audit.

## 2026-09-06 — Recent documents widget converted to Recent activity
- Full-width card now shows the 3 most recent items across documents (`modifiedAt`) + projects (`updatedAt`) + jobs (`appliedDate`), each deep-linking to its page; title `Recent activity`, `Activity` icon, sky-blue accent kept. Slot id `documents` unchanged so saved layouts/hidden prefs survive; big count omitted, footer still opens Documents.
- Prior snapshot: Dashboard widgets bolder (solid accent top bar + saturated icon chips).

## 2026-09-06 — Dashboard widgets bolder multi-color
- Widget top edge is now a solid full-width 3px accent bar (was transparent-fade 2px gradient); icon chips are saturated (`--widget-accent` fill + `--on-fill` glyph, active-pill shadow). Per-module hues unchanged.
- Prior snapshot: Home sidebar accent follows primary crimson (ADR 0031).

## 2026-09-06 — Home sidebar accent follows primary (ADR 0031)
- Dashboard nav item + Home group remapped `work→home` (`navigation.js`); new sidebar `home` mapping consumes `var(--color-primary)` so HOME label + Dashboard pill are crimson in both themes. Code group keeps Work indigo.
- Prior snapshot: Light primary unified to Crimson Noir #a83b59 (ADR 0030).

## 2026-09-06 — Crimson primary in light theme (ADR 0030)
- Prior light primary Electric Indigo `#4f46e5` superseded by Crimson Noir `#a83b59` (hover `#8c2f4b`, tint `#fbe8ed`); tokens glow/gradients + landing light variant follow. Work/Chats stay indigo, `prism` keeps indigo.
- Prior snapshot: WaveLoader stripped to music-bar equalizer on cinematic backdrop (screen-reader label kept).

## 2026-09-06 — Loading screen redesign (from prior commit f81e6b0)
- Branded WaveLoader card (orbit ring + wave bars + progress) and matching LoadingState (`components/WaveLoader.jsx`, `components/ui/LoadingState.jsx`, `wave-loader.css`, `loading-state.css`).

## 2026-09-06 — Wave F: You group + closeout hardening (program complete)
- `settings.css` (1954) → 8 scoped files; `themes.css` (641) → shell/controls/customizer; `landing-auth.css` (997) → public-shell/auth-forms/auth-onboarding/auth-recovery; `header.css` (1728) → 7 files (topbar/eve-shell/eve-messages/eve-composer/search/notifications/profile).
- `EvePage` (642) → constants + `EveActiveView` + `useEveLibrary` hook (471); `DocumentsPage` → documents package (editor + drive-import modals, 453); `previewFor` shared to `utils/evePreview.js`.
- Hardening: `.auth-back` 44px target; gates clean (no demo/mock/hack content).
- Closeout: `App.jsx` pages map → `appPages.jsx` (prop parity script-verified 41=41; App 762→517); modal sessions bar → `EveModalSessions` (498).
- Known exception (split deferred — real-time audio coordination, needs call QA): `useEveVoice` (551).

## 2026-09-06 — Wave E: Mail, WhatsApp, Team Chats, Contacts
- `MailsPage` (631) → `pages/mail/` package (utils/connect/folders/list/reader/composer + shell); `mails.css` (899) → shell/folders/list/connect/reader.
- `WhatsAppPage` (801) → hooks (message actions, pairing with live QR updates) + sync/empty states; removed dead confirm-pairing handler; `whatsapp.css` (3043) → 12 scoped files wired per component.
- `chats.css` (569) → shell/thread; `contacts.css` (657) → shell/grid/modals; Chats title → Team Chats.
- Connect accents: mail unread edge, WA active-chat edge, contact card edge.

## 2026-09-06 — Wave D: Eve, Calls, Avatar, Compete
- `eve.css` (2507) split into 10 scoped files (shell/messages/thoughts/composer/composer-box/skills/subpages/schedules/call-stage/call-live) wired via `EvePage`.
- `EveChatSection` (652) split into feed/composer/thought-history + shell facade; unused imports removed.
- `calls.css` (1274) split into 6 files (page/layout/scheduled/overlay/eve-call-ui/schedules-card) wired per component (page, CallScreen, overlay, scheduler, Eve call section, schedules card).
- Calls accent edge on `.call-screen`; new `compete.css` shell (section rhythm + tab placement).

## 2026-09-06 — Wave C: Studio, Jobs, Hackathons
- `JobsPage` (512) split: `pages/jobs/` package (timeline, modals with shared field builder); eyebrow → Create; growth accent on job cards.
- `studio.css` (1641) split into 7 scoped files (shared/hero/gallery/builder/stage/planning/questions) wired per page; StudioTabs already cross-link all three surfaces.
- Hackathons eyebrow → Create; ember accent on hackathon cards.

## 2026-09-06 — Wave B: Workspace, Projects, Documents
- `workspace.css` (1839) split into 7 scoped files (toolbar/filetree/editor/panels/eve/dialogs/overview) wired per component; overview header rhythm + workspace-amber card accents.
- Removed fake avatar initials (§1.8) from project grid + detail cards (real member counts); dropped dead avatar CSS in the split; `projects.css` (1094) split into list/cards/detail/lifecycle; grid-card projects accent; Projects eyebrow → Code.
- Documents list search (name/desc/tags/category) + filtered empty state; eyebrow → Code; documents accent edge.

## 2026-09-06 — Wave A: Dashboard, Todos, Calendar
- Dashboard command header (greeting + date + live focus summary); widget module-accent top edge; `dashboard.css` (759) split into `dashboard.css` + `dashboard-customize.css`.
- Todo progress bar (done % + overdue count), overdue flags + danger styling.
- `CalendarPage` (705) split into `pages/calendar/` package (toolbar/month/detail/utils + barrel, shell 188 lines); `calendar.css` (762) split into toolbar/grid/detail; new Today-jump button.
- Canonical `compete` destinations (dashboard config/widgets, header notifications, calendar + stats links); widget ids frozen so saved layouts survive.

## 2026-09-06 — Phase 2 shell additions (ADR 0029)
- New `MobileTabBar` (Home/Search/Eve/Studio/You, fixed ≤900px, safe-area, module-accent actives); `starwaves:open-search` event bridge to the header palette; content bottom clearance.
- Sidebar footer `Ask Eve` button (Eve accent, 44px collapsed, tooltip-wired) opening the lazy `EveAssistantModal`; `onWorkspaceChanged` threaded via `AppLayout`. Shell audit found the rail/header mature — no visual churn.

## 2026-09-06 — Phase 1: Crimson Noir default + motion language (ADR 0028)
- Fresh visitors (no stored theme) land on Crimson Noir dark: `prefersDarkTheme` in `useThemeCustomizer`, `Header` toggle init, pre-paint `dark-theme` class + `theme-color #0d080a` in `index.html`. Stored preferences untouched; preset engine unchanged.
- `.app-page-enter` CSS route transition (`key={activePage}`, motion-token timed, reduced-motion freeze) — no chunk cost.
- Boy Scout: `.theme-toggle` `!important` removed; `.icon-button` 44px on coarse pointers.

## 2026-09-06 — IA merges implemented (ADR 0027 Accepted)
- `EvePage` TabNav (Chat/Sessions/Memory/Voice/Schedules, URL-synced both ways); sidebar keeps one `Eve`; `AppLayout` highlights parent ids.
- New `CompetePage` (Contests/Stats tabs over existing pages); `compete` nav entry + router id; `competitive-coding`/`stats` render it with matching tab (dashboard widgets, calendar links, `/app/competitive` URL unaffected).
- `StudioTabs` (Builder/Apps/Templates) on all three Studio pages; sidebar keeps one `Studio`.
- `Chats`→`Team Chats` (nav + palette). Old ids all still resolve; no dead routes.

## 2026-09-06 — Phase 0 IA regroup (ADR 0027 Proposed)
- `config/navigation.js`: 29 items regrouped Home/Code/Create/Evolve/Connect/You (display-only, ids frozen, order = sidebar order); `GROUP_MODULE_MAP` repointed with existing module keys (no CSS changes); `Chat`→`Eve` label. Search badges + page eyebrows realigned. Route merges (Eve tabs, Compete page, Chats3, Studio children) documented as pending sign-off.

## 2026-09-06 — Auth full-bleed split (amends ADR 0025)
- Outer card removed: `.auth-split` fills `100dvh` edge-to-edge, hairline split border, form column centers content capped at 440px (`.auth-split__form-inner`, foot tagline beneath), brand floor rescaled to `55%`, obsolete light-theme block deleted (tokens pinned dark).

## 2026-09-06 — Auth pinned to landing theme (ADR 0026)
- `auth-split.css` pins `.auth-cinematic` to Crimson Noir tokens (canvas/card/maroon primary/rose focus/Eve accents, glow, gradient, shadows) via doubled-class scope that beats `html.dark-theme`; form pane uses `--bg-primary` against the brand panel's `--bg-card`. No markup changes — all auth styles already consume tokens.

## 2026-09-06 — Auth split-screen with brand panel (ADR 0025, supersedes 0021)
- `AuthShell` renders brand `aside` (logo, per-mode headline/body, triad) + form pane inside `auth-cinematic` root; `panel` prop with recovery-neutral defaults; `AuthPage` (login/signup/reset) and `ForgotPasswordPage` pass mode copy, forms untouched.
- New `styles/pages/auth-split.css` (~200 lines): split grid, perspective floor grid (`rotateX` plane, 7s drift loop, horizon glow, mask fade), entrance rise, ≤900px stacked banner, reduced-motion freeze.
- `landing-auth.css`: retired dead `__card/__top/__brand` rules, retargeted ≤900/480px queries at split panes.

## 2026-09-06 — Landing bold experimental redesign (ADR 0024)
- `pages/landing/`: Code/Create/Evolve narrative (`data.js` rewrite, generic illustrative minis), display type + word reveal + mouse orb + 3D-tilt stage + proof marquee (Hero), numerals + rule draw (Manifesto), dolly zoom + layoutId tab pill + 6s auto-advance (Showcase), typewriter terminal + looping chat demo (Eve), bento + spotlight hover (Features), parallax ghost numerals (Workflow), sticky split FAQ, rings + magnetic CTAs + module marquee + columnar footer (Finale), progress bar + floating pill + mobile drawer (Nav), `useMagnetic.js` hook.
- `cinema.css` (524 lines) split into `cinema-{base,hero,sections,motion}.css` (all <400 lines, still `.cinema`-scoped); `LandingPage.jsx` imports four modules; Crimson Noir scenery retained.

## 2026-09-06 — Multi-color redesign: module accent theming, vibrant semantic tokens, monochrome retirement (ADR 0019)
- Base light/dark themes default to Electric Indigo primary + Sky/Emerald/Amber/Rose/Purple semantics; `PALETTE_GROUPS` restructured to spectrum + vibrant duo; Sidebar/Dashboard/Badge module accent coding.

## 2026-09-04 — Neutral Gray mono theme preset
- `website/src/styles/themes/gray.css` + `presets.js`: balanced true-neutral gray theme with pure grayscale surfaces (26 presets total).

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
## 2026-08-30 — Usage page fix + Eve tool calling + Cache tuning + CORS 429
- **Eve tool calling (ADR 0002):** `openai_compat` flat→nested `function` conversion fixes OpenRouter/Ollama/OpenCode/Groq; add `groq` to `PROVIDER_CLIENTS`.
- **Cache tuning:** `core/cache.py` presets `SHORT 30/MEDIUM 60/LONG 300` with per-user `prefix:user_id:hash`; `request.js` default 30s + dedup + `CACHE_TTL_OVERRIDES` (`/ui/preferences` 120s, `/auth/me` 60s, `/usage/` 15s, `/eve/sessions` 15s).
- **CORS 429:** Nginx `$cors_allow_origin` map + `proxy_hide_header` + `RateLimitMiddleware` adds `Retry-After`+CORS on 429; `aiModelsApi` retries 2 + 60s cache; `AiModelsSection` dep fix.

## 2026-08-30 — Usage page: honest empty state, column-major heatmap, cache invalidation
- **Backend:** `usage.py` routes `CACHE_TTL_LONG→SHORT`, remove dead `_sync_session` + unused `DbClient`; `services/usage.log_usage` invalidates `usage:summary|logs:{user_id}` + dict-direct token extraction for `prompt/completion/total`; `schemas/usage.UsageSummary` expanded with `daily_by_model/peak/longest/current_streak/longest_streak/model_list`.
- **Frontend:** `UsagePage.jsx` remove 4.9M/GLM demo spikes, use `EmptyState` when empty, `topMetrics.longestLabel` now `formatTokens`, unified `getHeatLevel` (0/<100k/<800k/<2M), `Weekly`/`Cumulative` modes, `clampTooltipX`, dynamic `heatmapMonths`, `trend`/`donut` honest; `usage.css` heatmap `grid-auto-flow:column` + `7 rows`; `request.js` `/usage/` TTL `0→15s` + `usageApi` respects cache.

## 2026-08-31 — Frontend audit fix
- **Tokens:** `tokens.css` add type scale `--text-2xs→4xl`, `--leading-*`, `--font-weight-*`.
- **Hierarchy:** `base.css` PageHeader/dashboard/contacts `.page-heading h1` unified via `var(--text-4xl)`; `contacts/index.jsx` migrate to `PageHeader` primitive; `contacts.css` padding/gap/radius/shadow tokenized; `projects.css` grids `min(100%,310px)`, gaps `var(--card-gap)`, radii `var(--radius-md)`, add `.project-detail-grid--compact`, `.project-page-error`, `.project-progress-actions-detail`.
- **Consistency:** `TodoPage.jsx` EmptyState + `.todo-item-actions`, focus-within + coarse pointer touch; `WorkspacePage.jsx` new file/folder → `Modal`+`FormField`; `ChatsPage.jsx` + `chats.css` extract `no-active-chat--large/compact`, `chat-cta-button`, `chat-empty-messages`, `chat-send-error` (monochrome); `CustomPage.jsx` card/code/hint classes.
- **Polish:** `calendar.css` monochrome `#444→color-primary`, `#6a6a6a→text-secondary`; `workspace.css` error `#fef2f2→bg-secondary`, `#22c55e→color-primary`, `#f59e0b→text-secondary`, `#d97706/#fffbeb→bg-tertiary/border`, footer; `buttons.css` focus/disabled; `utilities.css` avatar helpers; `Header.jsx` avatar class cleanup; `CalendarPage.jsx` meta spaced class.
- **Responsive:** grids `min(100%, …)` prevent 320 overflow; `contacts-grid` gap token; `todo-delete` coarse fix; `layout-symmetry` unchanged (900 breakpoint kept intentionally — standardize next pass if needed).
- **Verify:** `npm run lint` (1 no-useless-escape warning only in MailsPage) + `npm run build` 575kB index 154k gzip ok.

## 2026-08-31 — Frontend audit fix p2
- **WhatsApp:** `WhatsAppInfoDrawer.jsx` 12 inline `style` → classes (`whatsapp-drawer-header/title/profile/card/row/participant/security/media/doc/starred` + `avatar--lg/sm`), `WhatsAppChatList.jsx` spacer/pin/muted/preview-strong/empty, `WhatsAppQrModal.jsx` loading-text/copy-btn/spaced actions + `whatsapp.css` 30+ tokenized classes; context menu position kept (dynamic); add `aria-label`/`role`/`onKeyDown`.
- **Headers:** `projects.css` `.project-page-heading h1` `clamp→var(--text-4xl)`, `p`→`var(--text-2xs)`, gap/padding tokenized.
- **A11y:** `Sidebar.jsx` `onFocus`/`onBlur` + `aria-label` for tooltip keyboard; `WorkspaceFileTree.jsx` `aria-expanded`/`aria-current`/`aria-label`; `WhatsAppChatList.jsx` + `ChatsPage.jsx` `aria-current` + `aria-label`.
- **Responsive:** `workspace.css` `@media (pointer:coarse)` `ws-card-actions`/`file-tree-action`/`todo-delete` 44px; `ws-card` radius `12px→var(--radius-lg)`.
- **Verify:** `npm run lint` clean (1 warning) + `npm run build` 461kB css 67k gzip, 574kB index ok.

## 2026-08-31 — Frontend audit fix p3
- **ProfileCard:** 5 inline `style` → `profile-verification-actions/verified-badge/verify-btn/feedback-spaced` in `settings.css` with `var(--text-sm)` + `var(--space-*)`.
- **WhatsApp bubble/composer:** `WhatsAppMessageBubble.jsx` `transform`→`forwarded-flip`, `cursor`→`quoted-clickable` + keyboard `role`/`onKeyDown`, `audio-time/doc-card` tokenized; `WhatsAppComposer.jsx` `eve-prompt-label/tray-label/row/file-input/recording` classes in `whatsapp.css`; add `aria-label` for emoji/attach/recording.
- **Metrics:** `style={{` 181→159 (`-22`, -12%); WhatsApp bubble/composer/profile drop from top-5; `npm run lint` clean + `npm run build` 574kB index 154k gzip ok.

## 2026-08-31 — Build scripts + backend-hosted auto-update (ADRs 0003/0004)

- **Scripts:** `scripts/build-{android,desktop,ota,all}.{ps1,sh}` + `lib/common.ps1` (Node/Java/Android SDK/Rust checks, VITE_API_URL shadow, version sync `package.json→gradle/tauri.conf`, `vite build + cap sync/gradlew` and `tauri build`, artifact `android.json/latest.json/bundles` generation, optional `scp -Publish`). `package.json` bump `0.0.0→0.1.0`, scripts `android:*`, `tauri:*`, `define __APP_VERSION__`, optionalDeps `capgo/updater`, devDep `@tauri/cli`.
- **Backend:** `server/static/updates/{latest,android,bundles}.json` (stubbed), `app/services/updates.py` (file manifests + semver `is_newer`), `app/schemas/updates.py`, `app/api/routes/updates/{check,latest}` (+ `app/main.py` mount `/updates→StaticFiles`, `docker-compose` bind `./server/static/updates:/app/static/updates`, `nginx` `/updates` proxy burst 60, `core/cors` tauri `tauri://`/`https` allows, `core/config` `updates_dir/updater_secret`).
- **Frontend updaters:** `lib/{updatesApi,desktopUpdater,androidUpdater,otaUpdater}`, `hooks/useAutoUpdater` (startup 3.5s + 6h + visibility/resume, per-version dismiss), `components/ui/UpdateBanner` + `styles/components/update-banner.css` (integrated via `App.jsx`), `pages/settings/UpdateSection` (manual check via `check?platform`) + `vite config` external for `@capgo/@tauri`.
- **Tauri:** `src-tauri/tauri.conf.json` bundle `msi,nsis` + `createUpdaterArtifacts v1Compatible` + `plugins.updater` endpoint `api.starwaves.../updates/latest.json`; `Cargo.toml` `updater/process`; `src/main.rs` plugins; `icons/icon.*` from `public/starwaves-logo.png`; signing via `TAURI_SIGNING_PRIVATE_KEY` env (pubkey in conf, `force:false`).
- **Android:** `cap sync + gradle` with `REQUEST_INSTALL_PACKAGES` deferred (Phase 1 browser `window.open(url)`), versionCode monotonic, OTA via self-host `bundles/latest.json` capable (Capgo plugin optional).
- **Docs:** `docs/BUILD.md` (prereqs, debug/release/publish, troubleshooting), `docs/adr/0003-build-scripts-android-tauri.md`, `0004-backend-hosted-auto-update.md`, `README` index, `context.md` last-updated, `.gitignore` keys/binaries, `nginx` CORS maps, verify `npm run lint && npm run build` ok.

## 2026-08-31 — AI provider hardening (ADR 0005) — universal OpenAI + adapter fixes

- **Core:** `core/config.py` `DEFAULT_AI_PROVIDER ollama→openai`, `OPENAI_MODEL gpt-5-mini→gpt-4o-mini`, `GROQ_MODEL llama-3.1-70b→llama-3.3-70b-versatile`, `OPENROUTER_MODEL gpt-4o→gpt-4o-mini`.
- **Config fallback:** `ai_models/config.py` now `_first_available_provider()` priority `openai→anthropic→gemini→groq→openrouter→ollama→opencode`; `build_ai_config("default")` resolves to first available, not hard-coded ollama; `_client_options` injects OpenRouter `HTTP-Referer`/`X-Title` + suppresses placeholder `Bearer ollama` for discovery.
- **Catalog/discovery:** `catalog` doc update; `discovery` prefix `gpt-5/o4/gpt-3/4` broadened, cache handles `ollama` placeholder, `_fetch_openai_compatible_models` no auth for placeholder + Referer/Title for OpenRouter, unified mirrors fix.
- **Adapters:** `openai` streams `reasoning` deltas; `anthropic` `MAX_TOKENS 4096→8192` + base_url forwarding; `gemini` thought/thinking handling for 2.5+ (`thought_signature`); `openai_compat` OpenRouter default_headers injection.
- **Docs:** `docs/adr/0005-ai-provider-hardening-universal-openai.md` + `README` index; `context.md` last-updated.

## 2026-09-01 — Eve Avatar Live2D/3D (ADR 0012) — dual renderer + global + inline + auto + upload

- **Frontend:** `components/eve/avatar/` 11 files (`EveAvatar`, `EveGlobalCompanion`+`Host`, `EveInlineAvatar`, `VrmModel`/`Live2DModel` procedural fallbacks, `useEveAvatarState`/`useLipSync`/`useEyeTracking`/`useAvatarPref`/`useAvatarLifecycle` + `avatarConstants`/`avatarTokens` + `EveAvatarProvider`) + `styles/components/eve-avatar.css` (glass, tokens, reduced-motion) + `lib/eveAvatarApi` + `pages/settings/EveAvatarSection` (renderer/motion/scale, model grid 4 examples, upload 12MB + zip guard) + `App.jsx` provider + `AppLayout` global dock + `EvePage` inline header + `EveCallSection` avatar row + `WorkspaceEvePanel` micro. `vite.config` manualChunks `avatar-3d`/`avatar-live2d`, `App.css` import, `public/avatars/` examples + `ATTRIBUTION.md`.
- **Backend:** `schemas/eve_avatar` + `services/eve_avatar` (prefs in `ui-preferences.eve_avatar`, `eve_avatar_uploads` capped 20, validate ext/size/magic/zip `model3.json` traversal, store `WORKSPACE_STORAGE_PATH/avatars/{uid}/`) + `api/routes/eve_avatar` (`GET /preferences`, `PUT /preferences`, `GET /models limit+1`, `POST /upload` base64, `DELETE /models/{id}`) + `api/router` mount. Cached `SHORT/LONG` + invalidate `eve:avatar`+`ui:preferences`.
- **Docs:** ADR `0012-eve-avatar-live2d-3d.md` + `README` index, `context.md` one-liner.

## 2026-08-31 — Differentiated AI errors (ADR 0007) — rate_limit vs other

- **Contracts:** `ai_models/contracts` `AIServiceError(kind/status/retry_after)` + `classify_provider_error` (429 rate_limit/quota, 401 auth, 404 model, 422 context, 503 server) with Retry-After parsing.
- **Adapters:** `openai/anthropic/gemini/openai_compat` now `classify_provider_error` instead of generic 502; streaming iteration also classified.
- **Orchestrators:** `eve/chat` + `chat_stream` map `error.status_code` to HTTP 429/401/404/422/503 with Retry-After header; SSE error frames include `code/status/retry_after`.
- **Frontend:** `eveApi` propagates `code/status/retryAfter`; `EvePage`/`useEveAgentChat` no REST fallback on 429, show rate-limit banner; `EveChatSection` `eve-error-banner--rate/--auth` variants with Clock/Info + hints; `eve.css` monochrome left-accent.

*Generated: 2026-08-27 from former `context.md` history block. New changes go to `context.md` `Last updated` one-liner.*
