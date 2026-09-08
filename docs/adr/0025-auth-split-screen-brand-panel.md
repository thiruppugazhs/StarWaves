# ADR 0025 — Auth Split-Screen with Brand Panel

## Status

Accepted — Supersedes [ADR 0021](./0021-auth-cinematic-centered-card.md)

- Date: 2026-09-06
- Deciders: user (explicit request: split-screen signin/signup, minimal brand panel, form right, all flows, perspective grid floor)
- Tags: `frontend`, `auth`, `adr-0021`

## Context

ADR 0021 replaced the old 2-column split auth with a single centered 440px card (`AuthShell` + `auth-cinematic__card`), arguing one conversion surface and deleting the split-panel CSS. The centered card now reads as a floating form on an empty backdrop: on wide screens half the viewport is unused atmosphere, and login/signup/reset/forgot all share an identical narrow column with no brand storytelling at the moment of conversion. The user asked for a split-screen signin/signup: brand presence on one side, form on the other.

## Decision

Reintroduce the split — done properly this time, keeping ADR 0021's wins (one shared shell, cinematic backdrop grammar, theme tokens, mobile polish):

- Chosen approach: `AuthShell` renders a split container (brand `aside` left, form pane right) inside the existing `auth-cinematic` root, so all scoped form overrides (gradient submit, danger error) keep working. New optional props `panelKicker/panelTitle/panelBody` let login/signup/reset/forgot each set brand copy; form markup in both pages is untouched.
- Brand panel is minimal per request: logo row, one display headline, triad microcopy — plus a perspective floor grid (rotateX plane, slow background-position drift toward viewer, horizon glow, mask-faded under the headline). Token colors only, `aria-hidden` layers, frozen under `prefers-reduced-motion`, hidden in the stacked mobile banner.
- Scope: `components/auth/AuthShell.jsx`, new `styles/pages/auth-split.css` (~200 lines, starts the ADR 0022 follow-up of splitting 1033-line `landing-auth.css`), panel-copy props in `AuthPage.jsx`/`ForgotPasswordPage.jsx`, dead `__card/__top/__brand` rules retired from `landing-auth.css` with ≤900/480px queries retargeted.
- Amendment (2026-09-06): the split went full-bleed — outer card removed, `.auth-split` fills `100dvh` edge-to-edge with a hairline split border, form content capped at 440px via `.auth-split__form-inner`, foot tagline under the form column. Same intent, no new trade-offs.
- Responsive: ≤900px stacks to compact brand banner + full-width form; 16px inputs, 44px+ targets, safe-area rules preserved.

## Consequences

- **Positive:** brand storytelling returns at conversion; wide screens feel composed; one shell still serves all four flows; floor grid adds cinematic motion without images or deps.
- **Negative / Cost:** ADR 0021's centered card is retired after one cycle; split doubles visual QA (light/dark × split/stacked × reduced-motion); background-position animation repaints a small panel (bounded, masked, static under reduced-motion).
- **Follow-up:** continue splitting `landing-auth.css` per page (ADR 0022); photographic brand art can replace the grid via a panel slot if desired.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep centered card | Directly contradicts the explicit user request |
| Product-mock brand panel | User chose minimal quote card; mocks also risk demo-data (§1.8) perception |
| Old split CSS restored | That split was deleted for duplicating shell markup and hiding brand on mobile; this keeps one shell + responsive banner |

## References

- `website/src/components/auth/AuthShell.jsx:1`
- `website/src/styles/pages/auth-split.css:1`
- ADR 0021 `./0021-auth-cinematic-centered-card.md`
