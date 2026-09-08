# ADR 0031 — Eve Desktop Overlay Window

**Status:** Accepted  
**Date:** 2026-09-06  
**Authors:** AI agent (Antigravity)

---

## Context

Users want Eve's avatar (Live2D/VRM) to float above all other desktop applications in a transparent, chrome-less window — a persistent desktop companion visible while working in any other app. The feature is triggered by the existing "Enabled" toggle in the Avatar Studio Presence section.

---

## Decision

Use a **Tauri v2 secondary WebviewWindow** (`label: "eve-overlay"`) with:

- `transparent: true` + `decorations: false` + `alwaysOnTop: true` + `skipTaskbar: true`
- `visible: false` by default — shown programmatically via `open_overlay` Tauri command
- URL points to `/app/avatar-overlay` — a minimal React page with only `<EveAvatar>` on a transparent canvas

**State relay via BroadcastChannel** (`starwaves-avatar-overlay`): The `AvatarOverlayManager` component in the main window relays `prefs` and `starwaves:eve-state` window events into the BC so the overlay window receives live avatar prefs and Eve speech/thinking state without any API calls.

**Drag-to-move**: The overlay page uses `pointerdown` → `pointermove` on `window` to compute delta from start screen position, calling `invoke('move_overlay', { x, y })` each frame. Final position is persisted to `localStorage` and to `prefs.overlayPosition`.

**Right-click context menu**: Custom glass-pill menu with "Hide overlay" (calls `close_overlay`, keeps `enabled: true`) and "Close & disable" (relays `overlay-disabled` message back to main window via BC, then calls `close_overlay`).

**In-app companion suppression**: `EveGlobalCompanionHost` returns `null` when `isTauri() && prefs.enabled !== false` to avoid dual WebGL renderers on the same machine.

---

## Consequences

**Good:**
- Avatar floats above VS Code, browsers, terminals — the "desktop companion" UX.
- BroadcastChannel relay means zero extra API calls; state is eventually consistent.
- Position and size persist across sessions.
- Graceful: no-ops on web/Android where `window.__TAURI__` is absent.

**Trade-offs:**
- Requires `transparent: true` OS compositor support (Win10+, macOS, most Linux compositors).
- The overlay page has its own React + Vite bundle chunk (`avatar-overlay` manualChunk can be added if bundle grows).
- Eye tracking follows cursor only within the overlay window viewport (not full-screen cursor tracking), which is correct without accessibility concerns.

---

## Alternatives Considered

1. **CSS `position:fixed` with `z-index: MAX`** — stays within the app window, not above other OS windows. Rejected.
2. **Electron-style `always-on-top` with full Tauri event protocol** — more complex IPC. BroadcastChannel is simpler and already used for avatar sync (`AVATAR_BC_CHANNEL`).
3. **Single window with CSS overlay** — same as option 1. Rejected.

---

## Files Changed

- `src-tauri/src/lib.rs` — 4 new commands: `open_overlay`, `close_overlay`, `move_overlay`, `resize_overlay`
- `src-tauri/tauri.conf.json` — `eve-overlay` window definition
- `src/components/eve/avatar/avatarConstants.js` — `AVATAR_OVERLAY_BC_CHANNEL`, overlay defaults
- `src/components/eve/avatar/AvatarOverlayManager.jsx` — [NEW] side-effect manager
- `src/components/eve/avatar/EveGlobalCompanionHost.jsx` — suppress in-app companion on Tauri
- `src/pages/AvatarOverlayPage.jsx` — [NEW] overlay route page
- `src/styles/pages/avatar-overlay.css` — [NEW] transparent overlay styles
- `src/pages/AvatarPage.jsx` — overlay size sliders + desktop badge in Presence section
- `src/App.jsx` — `/app/avatar-overlay` route + `AvatarOverlayManager` mount
