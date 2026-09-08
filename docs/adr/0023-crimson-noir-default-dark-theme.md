# ADR 0023 — Crimson Noir Default Dark Theme

## Status

Accepted

- Date: 2026-09-06
- Deciders: Starwaves Core Team
- Tags: `frontend`, `theming`, `landing`, `adr-0019`

## Context

The approved brand direction ("Code / Create / Evolve") is a deep cinematic crimson system: near-black maroon canvas (`#0D080A`), maroon primary (`#6E1F35`→`#A83B59`), dusty-rose accent (`#C75A73`), warm-gray text, emerald success — plus atmospheric planet/mountain imagery on the landing. The default dark theme was indigo-based obsidian, which no longer matches the brand.

## Decision

- `styles/themes/dark.css` becomes Crimson Noir: bg `#0d080a/#1a0f13/#24121a/#2e1823`, primary `#a83b59` (the image's button/hover rose — more luminous than deep `#6E1F35`, which anchors `--gradient-primary`), accent `#c75a73`, text `#f8f9fa/#b6a9b0/#7a6a73`, border `#542033`, success `#22c55e`, glass/nav/tooltip shifted to maroon. `tokens.css` dark glow/gradient/focus follow (`--glow-primary` rose, `--gradient-primary` `#6e1f35→#a83b59`).
- Module accents (`--module-*`), warning/danger/purple, light theme and all 17 presets unchanged — crimson canvas with kept wayfinding hues.
- `pages/landing/cinema.css` scoped defaults repointed to crimson surfaces; all indigo glow literals converted to `color-mix(var(--cinema-primary/--cinema-eve)…)`; hero gains a var-tinted inline SVG scene (planet orb + twin mountain ridges with rose rim light, parallax drift, static under reduced-motion, dimmed on mobile). No binary assets.
- Contrast fixes found en route: text on primary fills (`mails` active folder, `public-nav-cta`, Eve voice orb) moved from `text-inverse` to `--on-fill` (near-black on maroon was ~2:1; white is ~7:1; light theme unaffected).

## Consequences

- **Positive:** whole app follows the brand from one file; landing matches the approved design; `presets.js`/`ThemesPage` pick it up with zero code changes; `scarlet` remains as a brighter-red alternative.
- **Negative / Cost:** muted `#7A6A73` on near-black is ~3.8:1 — accepted for secondary captions (body copy uses `#B6A9B0`, ~7:1); indigo module accents pop harder against maroon (accepted per kept-accents decision).
- **Follow-up:** photographic planet/mountain assets can replace the SVG scene via `public/landing/` slots if desired; 4-point star logo unchanged (out of scope).

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Ship as opt-in preset only | Rejected — user asked for the full design as the theme, not an option |
| Full crimson monochrome (recolor modules) | Rejected — user kept module accents for wayfinding |
| Binary hero imagery | Rejected — SVG keeps the palette rule (var-tinted, theme-aware, zero asset weight) |

## References

- `website/src/styles/themes/dark.css:1`
- `website/src/styles/tokens.css`
- `website/src/pages/landing/cinema.css:1`
- `website/src/pages/landing/sections/Hero.jsx`
- ADR 0019 `./0019-multi-color-redesign-and-module-theming.md`
