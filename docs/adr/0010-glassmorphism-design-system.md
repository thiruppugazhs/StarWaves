# ADR 0010 — Glassmorphism Design System

**Status:** Accepted  
**Date:** 2026-09-01

---

## Context

The Starwaves UI used flat, opaque surfaces throughout — solid `--bg-card` backgrounds on cards, modals, sidebars, and the topbar. While this is clean and minimal, it misses the depth and luminosity that modern productivity apps achieve. Adding a glassmorphism (frosted-glass) layer makes the UI feel more spatial and tactile without violating the existing monochrome + curated duotone design language.

Key constraints that shaped the decision:
- The 22-preset theme system (`light`, `dark`, `oled`, plus 12 curated duotones) must all work — glass must look correct on both light and dark canvases and on every accent hue.
- No new frameworks or CSS preprocessors (`AGENTS.md §4.1`).
- Must not regress legibility or accessibility.
- Must respect `prefers-reduced-motion`.

---

## Decision

Glass is implemented as a **purely additive CSS layer** — a new [`glassmorphism.css`](file:///c:/project/starwaves/website/src/styles/glassmorphism.css) imported last in `App.css`. It overrides `background`, `border-color`, `backdrop-filter`, and `box-shadow` on 12 surface categories using CSS custom properties.

### New tokens (`tokens.css`)
```
--glass-blur           18px
--glass-saturation     saturate(180%)
--glass-bg             rgba(255,255,255, 0.52)   (light)  |  rgba(18,18,18, 0.52)  (dark)
--glass-bg-card        rgba(255,255,255, 0.42)   (light)  |  rgba(14,14,14, 0.48)  (dark)
--glass-bg-overlay     rgba(255,255,255, 0.72)   (light)  |  rgba(10,10,10, 0.72)  (dark)
--glass-bg-sidebar     rgba(245,245,247, 0.68)   (light)  |  rgba(12,12,12, 0.65)  (dark)
--glass-bg-topbar      rgba(250,250,252, 0.78)   (light)  |  rgba(8,8,8,   0.72)  (dark)
--glass-bg-dropdown    rgba(255,255,255, 0.78)   (light)  |  rgba(20,20,20, 0.82)  (dark)
--glass-border         rgba(255,255,255, 0.72)   (light)  |  rgba(255,255,255, 0.10) (dark)
--glass-border-card    rgba(255,255,255, 0.50)   (light)  |  rgba(255,255,255, 0.07) (dark)
--glass-border-subtle  rgba(255,255,255, 0.28)   (light)  |  rgba(255,255,255, 0.04) (dark)
--glass-shadow         multi-layer drop + inset highlight
--glass-shadow-lifted  elevated version
--glass-shadow-modal   deepest version
```

### Background mesh (`base.css`)
`body::before` upgraded from a flat `--bg-primary` fill to a three-stop radial gradient mesh using only `--bg-secondary` / `--bg-tertiary` tokens (no arbitrary colours). This gives glass panels a visually rich background to refract against.

### Surfaces covered
1. **Topbar** — blur 18px, glass bg + border
2. **Sidebar** — blur 18px (collapsed + expanded)
3. **Cards** (`.card`, `.profile-card`, workspace/coding settings cards, project overview)
4. **Modals** (`.modal`, `.todo-modal`, `.drive-modal`, `.document-modal`, `.project-edit-modal`, `.job-modal`) — blur 24px
5. **Dropdowns** (`.custom-dropdown-menu`) — blur 20px
6. **Settings cards** (`.settings-card`, `.settings-card-header`)
7. **Search palette** (`.search-palette`, `.search-palette-overlay`)
8. **Metric cards**
9. **Alerts**
10. **Eve panel**
11. **Tab nav**
12. **Modal backdrops** — blur 8px (increased from 3px)

### Reduced motion
`@media (prefers-reduced-motion: reduce)` strips all `backdrop-filter` / `-webkit-backdrop-filter` while keeping the semi-transparent backgrounds — glass degrades gracefully to translucent flat panels.

---

## Consequences

- **Positive:** Depth, luminosity, spatial hierarchy — all 22 themes benefit automatically because glass tokens are alpha-relative to the underlying theme background.
- **Positive:** Fully isolated — removing glass is a single `@import` deletion.
- **Positive:** Duotone themes (abyss teal, ember tangerine, aurum amber, etc.) get beautiful accent-tinted glass for free because `backdrop-filter` picks up the coloured background mesh.
- **Neutral:** `backdrop-filter` is not supported in Firefox without the `layout.css.backdrop-filter.enabled` flag (enabled by default since FF 103). Surfaces degrade gracefully to semi-transparent panels.
- **Risk:** On very low-end GPUs, blur compositing can be slow. The `prefers-reduced-motion` media query mitigates this.

---

## Alternatives Considered

- **Per-component glass via inline styles** — Rejected: violates `AGENTS.md §4.3.4` (no inline styles) and would scatter the glass layer across dozens of files.
- **CSS-in-JS or Styled Components** — Rejected: `AGENTS.md §4.1` prohibits new styling libraries.
- **Tailwind `backdrop-blur-*` utilities** — Rejected: project uses Vanilla CSS only.
- **Only applying glass to modals** — Rejected: user approved full surface application for coherence.

---

## Files Changed

- [`tokens.css`](file:///c:/project/starwaves/website/src/styles/tokens.css) — `--glass-*` tokens in `:root`
- [`dark.css`](file:///c:/project/starwaves/website/src/styles/themes/dark.css) — dark overrides for all `--glass-*` tokens
- [`base.css`](file:///c:/project/starwaves/website/src/styles/base.css) — `body::before` radial gradient mesh
- [`glassmorphism.css`](file:///c:/project/starwaves/website/src/styles/glassmorphism.css) — **NEW** isolated glass layer (12 surface categories + reduced-motion)
- [`App.css`](file:///c:/project/starwaves/website/src/App.css) — `@import './styles/glassmorphism.css'` wired last
