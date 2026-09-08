# ADR 0031 — Home Sidebar Accent Follows Primary

## Status

Accepted

- Date: 2026-09-06
- Deciders: user (direction: Dashboard pill crimson like primary)
- Tags: `frontend`, `theming`, `navigation`

## Context

After ADR 0030 unified `--color-primary` to Crimson Noir, the sidebar Dashboard pill and HOME label stayed indigo. Root cause: they never consumed `--color-primary` — `navigation.js` mapped Dashboard and the Home group to module `work` (`--module-work: #4f46e5`), which ADR 0030 deliberately kept indigo for Code wayfinding. Mobile tab-bar Home already used `--color-primary`, so the sidebar was the outlier.

## Decision

- `config/navigation.js`: Dashboard item `module: 'work'→'home'`; `GROUP_MODULE_MAP` `Home: 'work'→'home'` (Code group stays `work`).
- `styles/components/sidebar.css`: new `home` accent mapping — `.nav-item[data-module="home"]` → `var(--color-primary)` / `var(--color-primary-light)`; group label `[data-group="home"]` → `var(--color-primary)`.
- No token values changed; Home is theme/preset-aware automatically (light/dark/customizer follow `--color-primary`).

## Consequences

- **Positive:** HOME label + Dashboard active pill are crimson in both themes, matching topbar/buttons; Code group label, Work badges, and dashboard widget default accent stay indigo — differentiation preserved.
- **Negative / Cost:** Home and primary are now coupled by design (a preset with an unusual primary recolors Home too) — accepted, that is the point of a primary token.
- **Follow-up:** Team Chats still uses `--module-chats` indigo; dashboard widgets default to `--module-work`. Unify those only on explicit direction.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Recolor `--module-work` token to crimson | Rejected — collapses Code group label, Work badges, and widget accents into primary; kills wayfinding kept in ADR 0019/0023/0030 |
| One-off sidebar override with hardcoded crimson | Rejected — breaks preset/dark awareness; tokens-first rule (§4.6.2-5) requires `var(--color-primary)` mapping |

## References

- `website/src/config/navigation.js:29`
- `website/src/styles/components/sidebar.css:256`
- ADR 0030 `./0030-crimson-primary-light-theme.md`
