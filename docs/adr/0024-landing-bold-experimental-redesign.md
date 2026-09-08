# ADR 0024 — Landing Bold Experimental Redesign

## Status

Accepted

- Date: 2026-09-06
- Deciders: user (direction: bold experimental, rich cinematic, all sections, full copy rewrite)
- Tags: `frontend`, `landing`, `framer-motion`, `adr-0019`, `adr-0020`, `adr-0023`

## Context

The landing (`website/src/pages/landing/`, scoped `cinema.css`) is already cinematic: parallax hero with planet/ridge SVG scenery (ADR 0023), pinned scroll Showcase (260vh) and Workflow (220vh), module accent theming (ADR 0020), Crimson Noir palette. But it reads as competent rather than memorable: uniform card grids, small display type (`clamp(36px,6vw,72px)`), static proof chips, no pointer-reactive surfaces, no marquee rhythm, mobile nav drops links entirely, and copy is feature-list prose rather than a narrative arc. `cinema.css` has also grown to 524 lines, breaching the 400-line module rule.

The user asked for a full redesign with Framer Motion and chose bold experimental + rich cinematic across all 9 sections with a full copy rewrite.

## Decision

Rebuild all 9 landing sections around the **Code / Create / Evolve** arc (ADR 0023 brand triad) as Signal → Build → Become, keeping the Crimson Noir canvas and pinned-scope palette exception:

- Chosen approach: Framer Motion 13 only (already installed) — `useScroll/useTransform/useSpring/useMotionValue`, `whileInView once`, `AnimatePresence`, `layoutId` tab pill; new co-located `useMagnetic.js` hook for CTA pull; transform/opacity-only animation.
- Copy: full `data.js` rewrite — display headlines, marquee module strip, generic illustrative minis (no fake user/company stats per §1.8).
- Motion upgrades: Hero word-reveal + mouse orb + 3D-tilt stage + proof marquee; Showcase dolly zoom + 6s auto-advance (pauses on interaction); Eve typewriter terminal + looping chat demo; Features uniform grid → bento; Workflow giant parallax numerals; FAQ sticky heading + layout accordion; Finale orbiting rings + magnetic CTAs; Nav scroll progress + floating pill + mobile drawer.
- CSS: split `cinema.css` (524 lines) into `cinema-base.css`, `cinema-hero.css`, `cinema-sections.css`, `cinema-motion.css`, all still scoped under `.cinema` and imported by `LandingPage.jsx` (page-level code-split pattern, `App.css` untouched).
- Scope: `pages/landing/LandingPage.jsx`, `pages/landing/data.js`, `pages/landing/sections/*.jsx` (+ `useMagnetic.js`), `pages/landing/cinema-*.css`.

## Consequences

- **Positive:** memorable above-the-fold (display type, orb, tilt); pinned sections feel like camera moves; mobile nav fixed; CSS back under limits; copy tells one story end-to-end.
- **Negative / Cost:** richer motion raises QA surface (dark/light × desktop/mobile × reduced-motion); auto-advance + scroll both drive Showcase state (guarded by interaction pause); larger Hero needs `min-height:auto` fallback on small screens.
- **Follow-up:** photographic planet/mountain assets can replace SVG scenery via `public/landing/` slots (ADR 0023); consider scroll-snap audit if pins feel heavy on low-end devices.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Fresh premium minimal (Linear-style) | User chose bold experimental; minimal wastes existing cinematic equity |
| Subtle motion only | User chose rich cinematic; pins/parallax are the product's differentiator |
| Hero-only refresh | User chose all 9 sections; partial leaves narrative incoherent |
| New animation library / 3D engine | Rejected per §7.5 (no new deps without need); Motion 13 covers springs, scroll, layout |

## References

- `website/src/pages/landing/LandingPage.jsx:1`
- `website/src/pages/landing/cinema.css:1`
- `website/src/pages/landing/data.js:1`
- ADR 0020 `./0020-landing-cinematic-module-theming.md`
- ADR 0023 `./0023-crimson-noir-default-dark-theme.md`
