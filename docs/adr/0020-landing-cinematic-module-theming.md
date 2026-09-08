# ADR 0020 — Landing Cinematic Module Theming

## Status

Accepted

- Date: 2026-09-06
- Deciders: Starwaves Core Team
- Tags: `frontend`, `landing`, `theming`, `adr-0019`

## Context

The marketing landing (`website/src/pages/landing/`, scoped `cinema.css`) was the last pure-monochrome surface: hardcoded `#000/#FFF` vars, `display:none` glows, and `data.js` tints all `#FFFFFF`. After ADR 0019 retired monochrome and introduced vibrant semantics plus `--module-*` accents, `/` felt disconnected from the app (indigo primary, Eve pink, Studio violet, Workspace amber).

The landing must keep its dark cinematic identity (first paint, conversion surface) while speaking the same color language, and gain a light variant that follows the system preference without JS theme branching.

## Decision

- Re-point `.cinema` root vars at global tokens (`--bg-*/--text-*/--border-*`, `--color-primary/accent/success/warning/danger/purple`, `--module-*`, `--gradient-*/--glow-*`) instead of hardcoded grays. Keep `.cinema` scope so nothing leaks into the app.
- Full section theming, one hue per section: Hero/Nav Work Indigo; Manifesto Work/Studio/Eve; Showcase Dashboard=work, Workspace=workspace amber, Calendar=calendar sky, Eve=eve pink; Eve spotlight `gradient-eve`; Features 8 cards mapped to todo/calendar/growth/projects/work/documents/mail; Workflow 01/02/03 work/studio/eve; FAQ primary; Finale studio→eve glow.
- Re-enable hero glows, showcase bg, finale glow and card top-sheen as module gradients with `glow-*` shadows; primary CTAs use `gradient-primary` (Eve CTA `gradient-eve`).
- Light variant via `@media (prefers-color-scheme: light)` plus `html:not(.dark-theme) .cinema` overrides mapping to light token values (slate surfaces, jewel tones). Dark remains default.
- Remove all inline hex in landing JSX (`LandingPage.jsx` curtain, `Hero/Eve/Showcase/Features/Workflow/Finale/Manifesto`) in favour of CSS classes (`is-work/is-studio/is-eve`, `cinema-feat--*`, `cinema-step--*`).
- Scope: `pages/landing/cinema.css`, `pages/landing/data.js`, `pages/landing/sections/*.jsx`, `pages/landing/LandingPage.jsx`.

## Consequences

- **Positive:** landing→app continuity; instant module recognition; conversion CTAs gain hierarchy via gradient + glow; a11y focus rings use `--border-focus`.
- **Negative / Cost:** cinematic pure-black purists lose sterile mono; light variant doubles visual QA (dark + light, desktop + 640px, reduced-motion).
- **Follow-up:** verify contrast ≥4.5:1 in both schemes; consider tying showcase scene color to `scene.color` CSS var for future scenes.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep monochrome landing | Rejected — contradicts ADR 0019 retirement and user request to update the theme |
| Single brand color everywhere | Rejected — loses per-module wayfinding established in Sidebar/Badge/Dashboard |
| JS theme prop drilling | Rejected — CSS-only variant respects tokens, dark overrides, and reduced-motion without prop churn |

## References

- `website/src/pages/landing/cinema.css:1`
- `website/src/pages/landing/data.js:1`
- `website/src/styles/tokens.css:90`
- `website/src/styles/themes/index.css:19`
- `website/src/styles/themes/dark.css:19`
- ADR 0019 `./0019-multi-color-redesign-and-module-theming.md`
