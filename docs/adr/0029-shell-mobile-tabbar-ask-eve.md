# ADR 0029 — Shell: Mobile Tab Bar + Sidebar Ask Eve

## Status

Accepted

- Date: 2026-09-06
- Deciders: user (program approval: Phase 2 shell rebuild)
- Tags: `frontend`, `shell`, `navigation`, `mobile`, `a11y`

## Context

The shell audit (Phase 2 survey) found a mature sidebar/header: collapsible rail, module accents, tooltips, ⌘K palette, Eve modal, mobile drawer. Two genuine gaps: phones got only a hamburger drawer (thumb-hostile for 5 daily destinations), and Eve — the product's signature — had no sidebar presence (only a header button). A blind visual rebuild would churn good code for no gain.

## Decision

- New `MobileTabBar` (Home · Search · Eve · Studio · You), fixed bottom ≤900px with safe-area padding, 52px targets, module-accent active states; content gets bottom clearance. Search fires a decoupled `starwaves:open-search` window event the `Header` listens for (same pattern family as existing `eve-ui-update`/`sync-invalidate` events) so palette ownership stays in one place.
- Sidebar footer gains an Eve-accented `Ask Eve` button (icon-only 44px when collapsed, full button when expanded, tooltip-wired) opening the existing lazy `EveAssistantModal`; `onWorkspaceChanged` threaded one level through `AppLayout`.
- Scope: `components/MobileTabBar.jsx` + `styles/components/mobile-tabbar.css` (wired in `App.css` order), `components/Sidebar.jsx` + `sidebar.css`, `layouts/AppLayout.jsx`, `components/Header.jsx` (event listener only).

## Consequences

- **Positive:** phones get one-tap primary navigation; Eve is reachable from every surface; no new deps, no routing changes, no chunk impact (modal/tab bar are tiny, modal stays lazy).
- **Negative / Cost:** fixed bar covers bottom content on ≤900px (mitigated with content clearance); one more global event name to know (`starwaves:open-search`).
- **Follow-up:** Wave rebuilds keep the bar labels in sync if IA labels change; revisit haptics/indicators only with evidence.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Full sidebar/header visual rebuild | Audit showed mature, token-clean code — churn without user-visible gain |
| Lift search state to AppLayout | Invasive prop-drilling across Header for one button; event bridge is the established pattern |
| Bottom bar with all 21 items | Thumb bars hold ~5 destinations; the drawer keeps serving the rest |

## References

- `website/src/components/MobileTabBar.jsx:1`
- `website/src/components/Sidebar.jsx:24`
- `website/src/layouts/AppLayout.jsx:1`
