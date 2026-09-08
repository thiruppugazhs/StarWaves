# Architecture Decision Records (ADRs)

> Living index of architectural decisions for **Starwaves**. See `AGENTS.md` §1.7 for the mandate and `_template.md` for the template.

## Rules

- Location: `docs/adr/NNNN-kebab-case-title.md` (zero-padded, sequential, never reuse numbers).
- Template: `_template.md` (Status, Context, Decision, Consequences, Alternatives).
- Commit: ADR must be in the **same commit** as the code it justifies.
- Lifecycle: `Proposed → Accepted → Superseded/Deprecated` — update `Status` in-place and cross-link replacement.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-no-sub-agents-context-first-adr-required.md) | No sub-agents, context.md first, ADRs required | Accepted | 2026-08-30 |
| [0002](0002-fix-eve-tool-calling-adapter.md) | Fix Eve tool calling for OpenAI-compatible providers and add Groq | Accepted | 2026-08-30 |
| [0003](0003-build-scripts-android-tauri.md) | Build scripts for Android (Capacitor) + Desktop EXE (Tauri) | Accepted | 2026-08-31 |
| [0004](0004-backend-hosted-auto-update.md) | Backend-hosted auto-update (Tauri signed + APK sideload + OTA) | Accepted | 2026-08-31 |
| [0005](0005-ai-provider-hardening-universal-openai.md) | AI provider hardening: universal OpenAI default + adapter fixes | Accepted | 2026-08-31 |
| [0006](0006-canonical-domain-starwaves-susindran-in.md) | Canonical domain starwaves.susindran.in + api.starwaves.susindran.in | Accepted | 2026-08-31 |
| [0007](0007-differentiated-ai-error-messages.md) | Differentiated AI provider error messages (rate limit vs other) | Accepted | 2026-08-31 |
| [0008](0008-oauth-deep-link-mobile-auth.md) | OAuth deep-link for native + mobile login layout | Accepted | 2026-08-31 |
| [0009](0009-ui-ux-design-system-and-routing-hardening.md) | UI/UX design system and routing hardening (modal dedup, delete redirect, navigateWorkspace, LoadingState, CustomDropdown search, inline style cleanup) | Accepted | 2026-09-01 |
| [0010](0010-glassmorphism-design-system.md) | Glassmorphism design system — frosted-glass tokens, background mesh, 12 surface categories, reduced-motion support | Accepted | 2026-09-01 |
| [0011](0011-spectrum-color-role-system.md) | Spectrum color role system — per-element unique hue assignment replacing monochrome rule; light/dark/stone preserved | Superseded by 0019 | 2026-09-01 |
| [0012](0012-eve-avatar-live2d-3d.md) | Eve Avatar — Live2D + 3D VRM dual renderer, global + inline, auto-theme, upload + examples | Accepted | 2026-09-01 |
| [0013](0013-default-openrouter-free-and-ui-strict-fix.md) | Default to OpenRouter Free Router and fix UI tool strict schema | Accepted | 2026-09-01 |
| [0014](0014-eve-provider-quota-fallback-and-streaming.md) | Eve provider quota fallback and streaming text animation | Accepted | 2026-09-01 |
| [0015](0015-lazy-public-shell-auth-storage-split.md) | Break request/authApi cycle (authStorage) and lazy-load public shell; index 248 → 152 kB | Accepted | 2026-09-04 |
| [0016](0016-modular-avatar-engine-chunks.md) | Modular avatar engine chunks (three-core/vrm-loader/pixi/live2d); all chunks < 600 kB, zero build warnings | Accepted | 2026-09-04 |
| [0017](0017-sub-100kb-shell-modals-keep-vendor-whole.md) | Sub-100 kB pass: defer shell modals (index 152→107 kB); vendor/icons stay whole with evidence | Accepted | 2026-09-04 |
| [0018](0018-optimize-all-lucide-pixi-themes.md) | Optimize all: lucide 1.40 (icons 469→43 kB), single-pixi override, theme leaf (index →113 kB), drop drei/fiber | Accepted | 2026-09-04 |
| [0019](0019-multi-color-redesign-and-module-theming.md) | Multi-color redesign, module accent theming, and monochrome retirement | Accepted | 2026-09-06 |
| [0020](0020-landing-cinematic-module-theming.md) | Landing cinematic module theming — ADR 0019 accents + light variant, full section theming | Accepted | 2026-09-06 |
| [0021](0021-auth-cinematic-centered-card.md) | Auth cinematic centered card — shared AuthShell for login/signup/forgot-password | Superseded by 0025 | 2026-09-06 |
| [0025](0025-auth-split-screen-brand-panel.md) | Auth split-screen — minimal brand panel + perspective grid floor, form right, all flows | Accepted | 2026-09-06 |
| [0026](0026-auth-pinned-landing-theme.md) | Auth pinned to landing Crimson Noir theme in both app themes | Accepted | 2026-09-06 |
| [0027](0027-app-ia-nav-regroup.md) | App IA regroup — Home/Code/Create/Evolve/Connect/You; Eve tabs, Compete, Studio tabs | Accepted | 2026-09-06 |
| [0028](0028-crimson-noir-default-and-motion.md) | Crimson Noir default for fresh visitors + CSS page-enter motion language | Accepted | 2026-09-06 |
| [0029](0029-shell-mobile-tabbar-ask-eve.md) | Shell: mobile bottom tab bar + sidebar Ask Eve + palette event bridge | Accepted | 2026-09-06 |
| [0022](0022-single-source-color-palette.md) | Single-source color palette in tokens.css — var() everywhere, dead legacy landing CSS removed | Accepted | 2026-09-06 |
| [0030](0030-crimson-primary-light-theme.md) | Crimson primary in light theme — unify with dark/landing, keep Work/Chats indigo | Accepted | 2026-09-06 |
| [0031](0031-home-sidebar-accent-follows-primary.md) | Home sidebar accent follows primary — Dashboard/HOME crimson, Code keeps Work indigo | Accepted | 2026-09-06 |
| [0023](0023-crimson-noir-default-dark-theme.md) | Crimson Noir default dark theme + landing planet/mountain SVG scenery | Accepted | 2026-09-06 |
| [0024](0024-landing-bold-experimental-redesign.md) | Landing bold experimental redesign — Code/Create/Evolve arc, rich cinematic motion, CSS split | Accepted | 2026-09-06 |
| [0032](0032-eve-desktop-overlay-window.md) | Eve desktop overlay window — transparent Tauri secondary window floating above all apps | Accepted | 2026-09-06 |
| [0033](0033-avatar-studio-framing-and-pan-zoom.md) | Avatar Studio framing — in-canvas drag-pan, wheel-zoom, dblclick-reset, persisted `userPan`/`userZoom` | Accepted | 2026-09-06 |
| [0034](0034-avatar-modeling-studio-projects.md) | Avatar modeling studio workspace with versioned scenes and managed binary assets | Accepted | 2026-09-06 |
| [0035](0035-studio-product-area-redesign.md) | Unified Studio product-area redesign with real-data presentation metadata | Accepted | 2026-09-06 |
| [0036](0036-studio-project-uuid-identifiers.md) | UUID identifiers for Studio project routes and full-height detail shell | Accepted | 2026-09-06 |
| [0037](0037-per-turn-eve-model-selection.md) | Per-turn EVE model selection in the Workspace Agent composer | Accepted | 2026-09-07 |
| [0038](0038-studio-preview-embedding-policy.md) | Scoped cross-origin embedding policy for signed Studio previews | Accepted | 2026-09-07 |
| [0039](0039-avatar-studio-editor-state-and-capabilities.md) | Avatar Studio schema v2, normalized formats, animation state, and capability-aware tools | Accepted | 2026-09-07 |
| [0040](0040-avatar-studio-eve-editor-actions.md) | Validated Eve-to-Avatar-Studio action protocol with frontend confirmation | Accepted | 2026-09-07 |

## How to add a new ADR

1. Copy `_template.md` to `NNNN-kebab-case-title.md` where `NNNN` is next integer.
2. Fill Status/Context/Decision/Consequences/Alternatives (300–500 words).
3. Add one-line entry to the Index table above.
4. Commit ADR with the code change it justifies; update `context.md` `Last updated` one-liner.

## Context loading

- Tier 0: `opencode.json` preloads `AGENTS.md` + `PROJECT_MAP.md`.
- Tier 1: `PROJECT_MAP.md` for navigation.
- Tier 2: `context.md` for cross-cutting / infra state.
- Tier 3: `Grep` (with `include`) + `Read` targeted files. No `Glob **/*` scans.
- Never use sub-agents — execute directly in the primary session (AGENTS.md §1.6).
