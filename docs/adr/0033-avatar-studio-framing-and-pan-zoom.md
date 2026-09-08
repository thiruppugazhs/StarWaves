# ADR 0033 — Avatar Studio: framing, pan/zoom gestures, persisted

> Framing and gesture controls for the Live2D / VRM avatar in the Avatar Studio, with persistence in user preferences.

## Status

- Date: 2026-09-06
- Deciders: @author
- Tags: `avatar`, `ux`, `frontend`

## Context

The Avatar Studio at `/app/avatar` renders the active model (Live2D Haru Greeter, 3D VRM, or procedural CSS fallback) at full stage size. The fit math anchored the model at `h * 0.52` and used a `0.85` margin factor, which clipped the head of tall models — users saw only the collar/tie filling the canvas with no way to recover the head. The HUD had a `Zoom` slider but no in-canvas gestures, and `prefs` had no notion of user framing. Reloading the page always reset the framing, which made any "I want to see the head and shoulders close-up" choice fleeting.

The two renderers (Live2D, three.js VRM) also behaved inconsistently: Live2D had no pointer handling; VRM had pointer-drag that orbited the model (turntable) but no pan, zoom, or reset.

## Decision

- **Root-cause fit fix** in `Live2DModel.jsx`: `scale = Math.min(w/mw, h/mh) * 0.92` (drop 0.85), anchor at `(0.5, 0.5)`, position at `(w/2, h/2)` — no vertical bias. `VrmModel` already framed the model on a 1.1 m camera distance; we add user-driven framing on top of that.
- **Gestures** (10% per wheel notch — option A, matches common design tools):
  - **Drag pan** on the mount — pointer capture, clamped to `±1000 px`, optimistic local + debounced (350 ms) persistence via `onTransformChange`.
  - **Wheel zoom** — exponential cursor-centered zoom, clamped `[0.3, 3.0]`. Live2D adjusts `panRef` so the world point under the cursor stays under the cursor; VRM scales `camera.position.z` on top of the existing `zoom` slider.
  - **Double-click reset** — clears `userPan` / `zoom` to defaults and persists.
  - **Reset framing** button (new, in HUD Appearance) — same as double-click but via a button. **Reset view** (existing) now also clears framing.
- **Persistence**: `userPan: { x, y }` is stored alongside the unified `zoom` value in the `prefs` JSON blob. The frontend and backend both validate zoom in the range `0.3..3.0`; defaults live in `AVATAR_DEFAULTS`.
- **Constants / clampers**: `PAN_MIN/MAX ±1000`, `ZOOM_MIN 0.3`, `ZOOM_MAX 3.0`, plus `clampUserPan` / `clampZoom`.
- **Wiring**: `EveAvatar` reads `prefs.userPan` / `prefs.zoom`, forwards both to the renderers, and exposes `onTransformChange(pan, zoom)` to the parent. `AvatarPage` debounces 350 ms and persists via `saveAvatarPreferences`. A small HUD hint reads `Drag to pan · Scroll to zoom · Double-click to reset`.
- **Cursor states** via `cursor: grab` / `.is-panning` on `.eve-live2d-mount` and `.eve-vrm-mount`.

## Consequences

- **Positive:** full model always visible by default; users can frame the model to taste; reload restores framing; both renderers behave consistently.
- **Negative / Cost:** framing adds one persisted key; wheel handlers must call `preventDefault` to avoid page scroll; refactored pointer handlers in `VrmModel` (drag-to-orbit removed — `autoRotate` still turntables if enabled).
- **Follow-up:** consider mirroring gestures on the global companion pill (currently pinned to its dock); consider a touch-pinch handler (currently pointer + wheel only).

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Session-only framing (no persistence) | User explicitly chose B (persist) for a stable framing experience. |
| 25% per wheel notch | User chose 10% (option A) for smooth, predictable zoom. |
| Slider-only (no gestures) | Doesn't match expected pattern for in-canvas framing; HUD already has a Zoom slider. |
| Persist `userPan` in viewport % instead of px | Adds a conversion step for little benefit; px is what Live2D and the gesture code already use. |

## References

- `website/src/components/eve/avatar/Live2DModel.jsx:175-184` (fit math fix)
- `website/src/components/eve/avatar/VrmModel.jsx:245-285` (gesture handlers)
- `website/src/components/eve/avatar/avatarConstants.js` (`clampUserPan`, `clampZoom`, `AVATAR_LIMITS.PAN_MIN/MAX`, `AVATAR_LIMITS.ZOOM_MIN/MAX`)
- `website/src/components/eve/avatar/EveAvatar.jsx:46-102` (wiring)
- `website/src/pages/AvatarPage.jsx:142-167` (debounced persist + reset)
- `website/src/styles/pages/avatar.css:108-118` (cursor states)
