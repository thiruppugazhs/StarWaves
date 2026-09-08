# ADR 0030 — Crimson Primary in Light Theme

## Status

Accepted

- Date: 2026-09-06
- Deciders: user (direction: crimson as primary)
- Tags: `frontend`, `theming`, `design-system`

## Context

The app spoke two voices: light theme primary was Electric Indigo (`#4f46e5`) while dark (`dark.css`), landing (`--cinema-primary`), and auth (`auth-cinematic`) were Crimson Noir (`#a83b59`). ADR 0023 deliberately kept light indigo for wayfinding; ADR 0028 made dark the fresh-visitor default, so most users never saw the mismatch. The user now wants one voice — crimson as the primary color everywhere.

## Decision

- `styles/themes/index.css` (light default): `--color-primary` `#4f46e5→#a83b59`, `--color-primary-hover` `#4338ca→#8c2f4b` (darker for light bg; dark keeps lighter `#c75a73`), `--color-primary-light` `#eef2ff→#fbe8ed`, `--border-focus` / `--scrollbar-thumb-hover` → `#a83b59`.
- `styles/tokens.css` (light): `--glow-primary` `rgba(79,70,229,0.25)→rgba(168,59,89,0.25)`, `--gradient-primary` `#4f46e5→#7c3aed` becomes `#6e1f35→#a83b59` (matches dark/landing), `--gradient-accent` second stop `→#a83b59`.
- Landing light variant follows: `pages/landing/cinema-base.css` `--cinema-primary`/`--cinema-focus` `→#a83b59`, `--cinema-surface-2` / nav hover `#eef2ff→#fbe8ed`; `cinema-hero.css` light glows `rgba(79,70,229…)→rgba(168,59,89…)`, violet secondary `→rgba(244,63,94,0.08)` (Eve rose, matches dark hero).
- Out of scope (kept indigo for wayfinding per ADR 0019/0023): `--module-work` / `--module-chats` (`#4f46e5`), `--cinema-work`, and the `prism` preset (opt-in indigo).

## Consequences

- **Positive:** Eve button, notification badge, avatar fallback, focus rings, and landing CTA share one crimson identity in both themes; no component changes (all consume `var(--color-primary)`).
- **Negative / Cost:** light-theme users who relied on indigo→crimson contrast between primary actions and Work/Chats accents now see primary vs Work differentiated the other way (crimson vs indigo) — accepted, differentiation preserved.
- **Follow-up:** if Work/Chats should also leave indigo, do it as a separate module-accent decision, not a primary-token change.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Change only `index.css`, leave tokens/landing light indigo | Rejected — glow/gradient/landing-light would still flash indigo, two voices remain |
| Recolor modules + prism to crimson too | Rejected — kills domain wayfinding and removes the opt-in indigo preset |
| Do nothing, keep light indigo | Rejected — contradicts explicit user direction |

## References

- `website/src/styles/themes/index.css:19`
- `website/src/styles/tokens.css:91`
- `website/src/pages/landing/cinema-base.css:15`
- `website/src/pages/landing/cinema-hero.css:146`
- ADR 0023 `./0023-crimson-noir-default-dark-theme.md`
- ADR 0022 `./0022-single-source-color-palette.md`
