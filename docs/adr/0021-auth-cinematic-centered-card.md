# ADR 0021 — Auth Cinematic Centered Card

## Status

Superseded by [ADR 0025](./0025-auth-split-screen-brand-panel.md)

- Date: 2026-09-06
- Deciders: Starwaves Core Team
- Tags: `frontend`, `auth`, `layout`, `adr-0019`

## Context

Login, signup, password-reset and the 4-step forgot-password flow used a 2-column split layout (`auth-brand-panel` + `auth-form-panel` in `landing-auth.css`): a hardcoded `#0a0a0a` brand panel beside a token-themed form. After ADR 0019/0020 moved marketing to a vibrant cinematic language, auth felt like a different product at the exact moment of conversion. The split also duplicated shell markup across `AuthPage.jsx` and `ForgotPasswordPage.jsx`, hid the brand on mobile (`display:none` + separate `auth-mobile-brand`), and left `auth-switch` base styles stranded in `missing-states.css`.

## Decision

- Replace the split with a single centered card on a cinematic backdrop: `AuthShell` (`src/components/auth/AuthShell.jsx`) owns the backdrop, glow grid, card wrapper, top row (back button + gradient brand mark) and tagline footer. `AuthPage` (login/signup/reset modes) and `ForgotPasswordPage` (4-step flow) render only their content as children.
- Zero logic changes: all handlers, validation, OTP, stepper, success card and copy stay identical; only wrappers and classes change.
- Backdrop reuses the landing grammar (indigo→violet→eve radial glows + faint grid) scoped as `auth-cinematic*` in `landing-auth.css`, both pages' existing stylesheet. Surfaces use theme tokens so light/dark follow automatically; primary submit uses `gradient-primary` + `glow-primary`; error banner moves to semantic danger tint.
- Delete dead split-panel CSS (`.auth-brand-panel`, `.auth-brand`, 2-col `.auth-page` grid, `.auth-mobile-brand` + its responsive overrides) and move `.auth-switch` base into `landing-auth.css` next to the form it belongs to.

## Consequences

- **Positive:** one conversion surface from landing→signup→login; brand visible on all viewports; shell markup written once; mobile no longer needs a special-case brand row.
- **Negative / Cost:** brand-panel marketing headlines are consolidated into the card heading (copy preserved in heading sub where it carried meaning); `landing-auth.css` stays large (pre-existing, out of scope).
- **Follow-up:** verify card contrast in light + dark, 320px width, and iOS 16px-input zoom behavior unchanged.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep split, retheme panel | Preserves the marketing→auth discontinuity and the duplicated shell markup |
| Minimal single column, no backdrop | Loses the cinematic continuity the redesign was asked for |
| Redesign AuthPage only | Leaves ForgotPasswordPage on dead split CSS and a divergent look |

## References

- `website/src/pages/AuthPage.jsx:89`
- `website/src/pages/ForgotPasswordPage.jsx:170`
- `website/src/components/auth/AuthShell.jsx`
- `website/src/styles/pages/landing-auth.css`
- ADR 0020 `./0020-landing-cinematic-module-theming.md`
