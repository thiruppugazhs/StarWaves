# ADR 0012 — Eve Avatar: Live2D + 3D VRM dual renderer with global + inline presence

## Status

Accepted

- Date: 2026-09-01
- Deciders: @starwaves
- Tags: `frontend`, `avatar`, `eve`, `live2d`, `vrm`, `three`, `pixi`, `ux`

## Context

Eve AI assistant was text + orb only (`EvePage` SSE streaming, `EveCallSection` concentric `wave-*` rings, `WorkspaceEvePanel` compact chat). No visual presence. User requested Live2D **and** 3D VRM, appearing both as a global floating companion and inline on Eve pages, auto-themed, with upload + validation + bundled examples, and must run on web + Capacitor Android + Tauri desktop.

Constraints:
- Frontend locked to React 19 + Vite + Vanilla CSS tokens (`AGENTS.md` §4) — no Tailwind/CSS-in-JS. Icons `lucide-react` only. One CSS per component, token vars.
- Bundle budgets: `vite chunkSizeWarningLimit 600`, manualChunks already for `firebase/monaco/grid`. Avatar must be lazy, not block `Landing`.
- Design system 25 presets (mono/duo/spectrum ADRs 0010/0011) — spectrum rule: one accent hue per semantic role, no duplicate non-neutral hues on screen.
- `prefers-reduced-motion` and mobile/low-memory fallback required.
- Backend layered (Routes→Services→Repos→Core), `ui_preferences` doc already stores per-user UI overrides with sanitized CSS/history-20.

Status quo (orb) lacks personality and voice-reactive presence.

## Decision

Add a **dual-renderer avatar subsystem** behind a shared abstraction:

- **Abstraction:** `EveAvatar` facade exposes `emotion` (`idle|listening|thinking|speaking|tool|error`) + `mouthOpen 0..1` + `lookAt {x,y}` + `themePreset`. Renderers implement same props.
- **Renderers:**
  - `VrmModel` — `three` + `@react-three/fiber` + `@react-three/drei` + `@pixiv/three-vrm` (VRM 1.0, blendShapes for mouth, VRM lookAt). Preferred on desktop/WebGL2 + `deviceMemory >=4`.
  - `Live2DModel` — `pixi.js`@7 + `pixi-live2d-display` + Cubism 4 core (`.model3.json`), expressions for `tool/error`. Preferred on mobile/low-memory or uploaded `.model3.json`.
  - `Auto` mode probes `WebGL2`, `deviceMemory`, `hardwareConcurrency`, uploaded ext; 8s load timeout → fallback CSS orb (never blank).
- **Placements (both):**
  - `EveAvatarProvider` (React Context) in `App.jsx`/`CustomUIProvider` — single `AnalyserNode` lip-sync source from `useEveVoice` TTS queue, shared emotion memo, `BroadcastChannel('starwaves-avatar')` for multi-tab pos.
  - `EveGlobalCompanion` — fixed `bottom/right` dock in `AppLayout` (96px minimized → 320px expanded), draggable (clamp + persist), hides on `/` landing, auto-minimizes when inline avatar in viewport (IntersectionObserver).
  - `EveInlineAvatar` — used in `EvePage` header and `EveCallSection` orb row (`Orb | Avatar` toggle, orb kept as a11y fallback). `WorkspaceEvePanel` collapsed bar shows 16px micro-head.
- **Theming auto:** `avatarTokens.js` maps 25 presets → tint. `mono` keeps VRM `#18181b`/`#27272a`, `duo` tints one accent onto secondary material only, `spectrum` ties avatar accent to `var(--color-primary)` uniqueness guard.
- **Preferences:** Extend `ui_preferences` JSON (`eve_avatar: {enabled, renderer, modelId, scale 0.8-1.2, position{x,y}, docked, motion}`) via existing `/ui/preferences/*` allowlist; cache 60s + history. No new table (YAGNI).
- **Upload + examples:** `POST /eve/avatar/upload` stores `WORKSPACE_STORAGE_PATH/avatars/{uid}/{uuid}.vrm|.glb|.zip` (reuse `workspace_files` helpers), validates ext/size/magic (`VRM` header, zip contains one `model3.json`), returns url. Bundled CC0 examples in `public/avatars/{vrm,live2d}/` + `ATTRIBUTION.md`. `GET /eve/avatar/models` paginated `limit+1`.
- **Scope:** `website/src/components/eve/avatar/*` (11 files <400L, `VrmModel` uses `GLTFLoader`+`VRMLoaderPlugin`+`VRMUtils`, `Live2DModel` uses `PIXI.Application`+`Live2DModel.from`), `styles/components/eve-avatar.css`, `lib/eveAvatarApi.js`, `pages/settings/EveAvatarSection.jsx`, `server/app/api/routes/eve_avatar.py` + `schemas/eve_avatar.py` + `services/eve_avatar.py`, `vite.config.js` `manualChunks` `avatar-3d`/`avatar-live2d`, `App.css` import, `public/avatars/` stubs + `scripts/fetch-avatar-models.ps1`, `context.md` one-liner.

## Consequences

- **Positive:** Eve gains presence without breaking mono/spectrum; dual renderer covers both anime (Live2D) and 3D tastes; global + inline satisfies power users and focus modes; auto probe + reduced-motion fallback keeps a11y/perf; upload path reuses proven `workspace_files` disk + cache pattern; lazy chunks keep initial load flat. Real `three`+`@pixiv/three-vrm` VRM blendShapes (`aa/oh`, `blink`, head bone) and `pixi-live2d-display/cubism4` Live2D params (`ParamMouthOpenY`/`ParamEyeL/Ropen`/`ParamAngleX/Y`/`ParamBodyAngleX`) driven by `useLipSync`/`useEyeTracking` + staggered `AnalyserNode` mouth.
- **Negative / Cost:** 683k avatar-3d + 606k avatar-live2d lazy chunks (170k gzip each, separate from vendor 647k); Cubism 4 core attribution required; VRM validation magic-byte + zip traversal; Tauri/Capacitor shader compile smoke-tested via stub GLB + model3.json.
- **Follow-up:** Replace stub `12-byte` VRM + minimal `model3.json` with CC0 VRoid + Haru textures via `scripts/fetch-avatar-models.ps1`; add TURN for strict NAT calls (out of scope, ADR 0004); avatar emotes for `workspace` events (project completed) — Phase 3.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Live2D-only | Locks to anime, heavier single-renderer lock-in, no VRM full-body reuse, still needs pixi + second canvas |
| VRM-only | Rejected user request for both; Live2D lighter on low-memory Android |
| readyPlayerMe/iframe SaaS | External auth leak, violates secrets + allowlist, network dependency |
| Single sprite sheet | Not Live2D/3D, feels cheap, no lip-sync scalability |
| New DB table `eve_avatars` | Overkill; `ui_preferences` already has versioned JSON + history 20 + sanitize; YAGNI |

## References

- `website/src/pages/EvePage.jsx`, `website/src/pages/eve/EveCallSection.jsx:183-210`, `website/src/styles/pages/eve.css:1890-2010`, `website/src/styles/tokens.css`
- `AGENTS.md` §1.7/§4.6, `PROJECT_MAP.md`, `docs/adr/_template.md`
- `server/app/api/routes/ui_preferences.py`, `server/app/services/ui_preferences.py`
