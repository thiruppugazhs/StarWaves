# ADR 0028 — Crimson Noir Default + App Motion Language

## Status

Accepted

- Date: 2026-09-06
- Deciders: user (program approval: Crimson Noir inward)
- Tags: `frontend`, `theming`, `motion`, `a11y`

## Context

The token engine (26 presets, customizer, density/elevation/motion options) is mature, but fresh visitors landed on the light theme while every new surface (landing, auth) speaks Crimson Noir dark — the product introduced itself in two voices. There was also no app-wide route transition (only the landing animates), and adding Framer Motion to the critical path would regress the index-bundle work of ADR 0015.

## Decision

- Crimson Noir dark is the default: absent `starwaves.theme` now resolves dark in `useThemeCustomizer` (×3 paths via a `prefersDarkTheme` helper), the `Header` toggle init, and a pre-paint inline script in `index.html` (plus `theme-color` `#0d080a`) so first paint never flashes light. Stored `light` is always respected; the preset engine is untouched.
- Motion language is CSS-only: `.app-page-enter` (fade/rise on `var(--transition-normal)`, driven by a `key={activePage}` wrapper in `App.jsx`) with a `prefers-reduced-motion` freeze. Zero chunk cost, follows the user's motion-token setting.
- Boy Scout fixes in the same pass: removed unjustified `!important` from `.theme-toggle` (specificity already wins by order) and raised `.icon-button` to 44px on coarse pointers.
- Scope: `hooks/useThemeCustomizer.js`, `components/Header.jsx`, `index.html`, `App.jsx`, `styles/utilities.css`, `styles/components/buttons.css`.

## Consequences

- **Positive:** one voice from first paint; route changes feel designed; touch targets + specificity hygiene improve.
- **Negative / Cost:** returning light-theme users are unaffected, but fresh visitors who preferred light get dark first (one toggle away, then persisted).
- **Follow-up:** Wave rebuilds reuse `.app-page-enter` timing tokens; revisit if a richer shared-element transition is ever justified against the bundle budget.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Framer Motion route transitions | Pulls motion into the critical index chunk (ADR 0015 regression) for little gain over CSS |
| Keep light default | Contradicts the approved Crimson Noir-inward direction |
| Migrate all presets to Noir variants now | Engine stays; presets remain user choice — restrictiveness without benefit |

## References

- `website/src/hooks/useThemeCustomizer.js:10`
- `website/index.html:11`
- `website/src/styles/utilities.css:44`
- ADR 0015 `./0015-lazy-public-shell-auth-storage-split.md`
- ADR 0023 `./0023-crimson-noir-default-dark-theme.md`
