# ADR 0022 — Single-Source Color Palette in tokens.css

## Status

Accepted

- Date: 2026-09-06
- Deciders: Starwaves Core Team
- Tags: `frontend`, `theming`, `tokens`, `adr-0019`

## Context

Color literals were scattered across ~15 stylesheets and several JSX files: monochrome leftovers (`#fff` on `#000` icon squares, `#09090b` button hovers), per-page re-definitions of the same grays, a fully dark-hardcoded `chats.css`, chart palettes in `UsagePage.jsx`, and ~1100 lines of dead legacy landing CSS in `landing-auth.css`. Editing any color meant hunting files, and several pages could not follow light/dark themes at all.

## Decision

- `styles/tokens.css` `:root` holds the single palette source (marked block): existing semantic/module/gradient/glow tokens plus new `--on-fill` (text on colored fills), `--canvas-white`/`--canvas-ink` (email/QR/preview canvases), `--nav-bg`, `--chart-1..6`, `--heat-1..4`, `--tooltip-*`, `--palette-ember/red`, `--menu-*`, `--media-stage`. Dark values in `styles/themes/dark.css`; per-theme presets in `styles/themes/*.css` stay (they are palettes by design).
- Rule: no bare hex/rgb literals outside `tokens.css`, theme presets, and the intentionally pinned `.cinema` scoped dark/light defaults. Consumers use `var(--…)`; translucent tints use `color-mix(in srgb, var(--…) N%, transparent)`.
- Converted: buttons, sidebar, settings-card, calls, chats, dashboard, mails, settings, studio, workspace, usage (heat + tooltip + chart palette), whatsapp (bubbles, menu, QR, sync states), eve (orb glows, thought wells), avatar, landing `data.js` scene colors (now `var(--module-*)`, theme-following), `UsagePage` inlines, `icsParser` defaults (`var(--text-muted)`), `cinema.css` fill text (`--on-fill`).
- Deleted ~1075 lines of dead legacy landing CSS from `landing-auth.css` (1981→905 lines); kept live `public-*`, `legal-*`, `auth-*`, `onboarding-*`, `.inline-link`.
- Deliberately out of scope: `var(--x, fallback)` resilience fallbacks, neutral shadow/backdrop `rgba(0,0,0/255,255,255,…)` elevation system, `ThemesPage` color-input defaults/placeholder, per-theme preset files.

## Consequences

- **Positive:** every brand color editable in one block; chats/calls/sidebar/buttons now follow light/dark; dead CSS gone; `color-mix` tints track their source hue automatically.
- **Negative / Cost:** minor dark-theme shifts where mono leftovers were fixed (calls hover `#09090b`→`--color-primary-hover`, eve orb glow white→`--glow-primary`); `landing-auth.css` still >500 lines (shared public/legal/auth sheet — split candidate).
- **Follow-up:** split `landing-auth.css` per page; audit shadow/backdrop neutrals into tokens if a use case needs them editable.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| New `colors.css` file | Rejected — `tokens.css` is already the mandated single home for shared values; a second file splits the source of truth |
| Convert shadows/overlays too | Rejected — elevation system churn with no editability benefit and high regression risk |
| Strip all var() fallbacks | Rejected — resilience with zero visual effect; churn without benefit |

## References

- `website/src/styles/tokens.css`
- `website/src/styles/themes/dark.css`
- `website/src/styles/pages/landing-auth.css`
- `website/src/pages/UsagePage.jsx`
- ADR 0019 `./0019-multi-color-redesign-and-module-theming.md`
