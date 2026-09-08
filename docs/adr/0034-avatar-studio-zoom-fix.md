# ADR 0034 — Avatar Studio: unified zoom state & smooth wheel zoom

## Status

- Date: 2026-09-06
- Deciders: @author
- Tags: `avatar`, `ux`, `frontend`, `zoom`

## Context

After ADR 0033 introduced framing and gestures, users reported that zoom felt jittery and the `userZoom` / `zoom` distinction was confusing — the HUD slider and mouse wheel both changed `userZoom` independently, causing desync between the UI and the model. The zoom limits were also too restrictive (`0.5–2.0`), and trackpad scroll events produced erratic behavior because `deltaY` values vary wildly between devices.

## Decision

### 1. Single `zoom` source of truth
Replace the separate `prefs.userZoom` with a single `prefs.zoom` that is the unified multiplier for both renderers. The HUD Zoom slider and mouse wheel both update this same value, guaranteeing they stay in sync. `userPan` remains unchanged.

### 2. Smooth exponential wheel zoom
Replace the fixed `1.1×` / `1÷1.1×` per-notch factor with `Math.exp(-delta * 0.002)`, which produces proportional zoom steps that scale naturally with the delta magnitude. This gives:
- Predictable ~2% zoom per mouse click
- Smooth trackpad gestures (no immediate min-zoom jump)
- Consistent feel across mice, trackpads, and scroll wheel variants (pixel/line/mousewheel delta modes)

### 3. Widened zoom limits
Change `AVATAR_LIMITS`:
- `ZOOM_MIN: 0.3` (was `0.5`)
- `ZOOM_MAX: 3.0` (was `2.0`)
- `USER_ZOOM_MIN: 0.3` (was `0.4`)
- `USER_ZOOM_MAX: 3.0` (was `4.0`)

### 4. Clamp helper added
Added `clampZoom(value)` to `avatarConstants.js` mirroring the existing `clampUserZoom`, but applied to the unified `zoom` rather than the separate `userZoom`.

### 5. Model-side integration
- `Live2DModel.jsx`: `zoomRef.current` is the single source; `applyTransform` uses `clampZoom(zoomRef.current)`; `onWheel` computes factor with `Math.exp`; `onTransformChange` emits `clampZoom(zoomRef.current)`.
- `VrmModel.jsx`: Same pattern — `zoomRef.current`, `clampZoom` in `applyFraming` and `scheduleTransformEmit`; wheel handler uses `Math.exp`; double-click resets to `1`.

### 6. HUD slider range
Update the Zoom slider in `AvatarPage.jsx` to `min="0.3"` / `max="3.0"` / `step="0.05"` to match the new limits.

## Consequences

- **Positive:** zoom slider and wheel are always in sync; smooth zooming on all input devices; wider zoom range lets users get much closer or farther; single source eliminates the `userZoom` / `zoom` confusion.
- **Negative / Cost:** removed `userZoom` from `prefs` blob (minor schema change); existing persisted `userZoom` values will fall back to defaults on first load after upgrade; wheel handler now calls `event.preventDefault()` (already the case); `clampZoom` is a new exported function.
- **Follow-up:** consider adding a "Zoom reset" button next to the existing Reset view / Reset framing; consider pinch-to-touch if touch targets are added later.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep separate `userZoom` + `zoom` | Caused desync; users couldn't tell which control was active; slider and wheel fought each other. |
| Fixed 10% per-notch `Math.pow(0.9, ...)` | Feels too coarse on trackpads; small deltas produce almost no visible change; exponential is more natural. |
| Widen limits only, keep current wheel math | Didn't fix the jitter/desync; users still get confused between slider and wheel. |
| Remove wheel zoom entirely, slider only | Doesn't match expected avatar-studio interaction model; users expect scroll-to-zoom. |

## References

- `website/src/components/eve/avatar/avatarConstants.js` — new `clampZoom`, updated limits
- `website/src/components/eve/avatar/Live2DModel.jsx` — unified `zoomRef`, exponential wheel
- `website/src/components/eve/avatar/VrmModel.jsx` — unified `zoomRef`, exponential wheel
- `website/src/pages/AvatarPage.jsx` — slider range 0.3–3.0, consolidated persist/reset
- `website/src/components/eve/avatar/avatarConstants.js` — `ZOOM_MIN: 0.3`, `ZOOM_MAX: 3.0`