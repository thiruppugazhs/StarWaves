# ADR 0026 — Auth Pinned to Landing Theme

## Status

Accepted

- Date: 2026-09-06
- Deciders: user (explicit request: auth uses the landing page's color theme)
- Tags: `frontend`, `auth`, `theming`, `adr-0023`, `adr-0025`

## Context

The split-screen auth (ADR 0025) renders through global theme tokens, so logged-out visitors — who carry no `dark-theme` class — see login/signup in the light theme (white card, indigo accents), while the marketing landing they just came from is Crimson Noir dark. The conversion surface feels like a different product: wrong canvas, wrong accent, wrong mood. The user asked for auth to use the landing page's color theme.

## Decision

Pin the auth shell to the landing's Crimson Noir values with a scoped override block (`.auth-cinematic.auth-cinematic` at the top of `auth-split.css`): canvas `#0d080a`, card `#1a0f13`, maroon primary `#a83b59`, rose focus `#c75a73`, Eve/danger `#f43f5e`, plus matching glow, gradient, shadow and text tokens. Form pane uses `--bg-primary` against the brand panel's `--bg-card` for quiet separation.

- This is the documented palette-rule exception for intentionally pinned scopes (`tokens.css` names the `auth-cinematic dark base` explicitly); values mirror `.cinema` + `dark.css`.
- The doubled class (0,2,0) beats `html.dark-theme` (0,1,1), so the pin holds whether the app theme is light or dark; dark-mode users see no change.
- No form markup or logic touched — every auth style already consumes tokens, so the whole surface (inputs, Google button, divider, stepper, banners, brand panel, floor grid) follows the pin for free.
- Scope: `styles/pages/auth-split.css` only.

## Consequences

- **Positive:** landing → login/signup is one continuous crimson surface; single source (one block) for the auth theme; dark-mode users unaffected.
- **Negative / Cost:** auth no longer follows the app light theme — a deliberate break from ADR 0025's "theme tokens follow automatically"; if the brand palette ever changes, this block must be updated alongside `.cinema` (both values are listed in the block comment's lineage).
- **Follow-up:** none planned; revisit only on a brand-palette change.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Per-element dark overrides | Scatters the theme across dozens of rules; token pin does it in one block |
| Force `dark-theme` class on auth pages | Leaks app-wide theme state from a page component; breaks if theme engine changes |
| Keep light-following auth | Directly contradicts the explicit user request |

## References

- `website/src/styles/pages/auth-split.css:1`
- `website/src/styles/tokens.css:108`
- ADR 0023 `./0023-crimson-noir-default-dark-theme.md`
- ADR 0025 `./0025-auth-split-screen-brand-panel.md`
