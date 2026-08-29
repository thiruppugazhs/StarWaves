# UI Agent Instructions

These instructions apply to all work under `website/`. The repository-level `AGENTS.md` remains authoritative — including §1.5 Tiered Context Loading (Tier 0 preloaded, `PROJECT_MAP.md` first, no `Glob **/*`). This file adds frontend-specific guidance based on the current StarWaves implementation.

## Architecture

- Use React 19 with Vite. Keep page composition in `src/pages`, shared layout in `src/layouts`, reusable UI primitives in `src/components/ui`, and feature components in `src/components`.
- Keep routing and workspace-level state in `src/App.jsx` and the existing hooks. Pages should receive data and callbacks through props rather than reaching into unrelated global state.
- Keep API and persistence work in `src/lib`, reusable client behavior in `src/hooks`, and pure transformations/parsers in `src/utils`.
- Preserve the current CSS import order through `src/App.css`: tokens, base, utilities, responsive rules, component styles, then page styles.
- Use the existing `src/components/ui` exports (`Avatar`, `Badge`, `EmptyState`, `Modal`, `FormField`, `PageHeader`, and related primitives) before creating a new wrapper or one-off control.
- Use `lucide-react` for interface icons. Do not add a second icon library or inline SVGs unless a branded asset genuinely requires it.

## Design system

- The interface is intentionally monochrome. Use the variables in `src/styles/tokens.css` for all colors, borders, shadows, radii, and transitions.
- Do not introduce red, blue, green, yellow, purple, gradients, or hard-coded status colors. Status variants must remain distinguishable through black, white, gray, borders, text, and iconography.
- Prefer semantic token names such as `var(--bg-card)`, `var(--text-secondary)`, `var(--border-color)`, and `var(--color-primary)` over raw color literals.
- Add shared visual rules to the appropriate component stylesheet and page-only rules to the appropriate file under `src/styles/pages`. Avoid inline styles and duplicated CSS.
- Support both the default light theme and `html.dark-theme`. Verify contrast, borders, focus rings, disabled states, and hover states in both themes.
- Reuse existing spacing, radius, shadow, typography, and transition tokens. Extract a new repeated value into `tokens.css` instead of scattering magic values.

## Components and behavior

- Components should have one responsibility, clear prop names, and controlled state only when the parent needs to own that state.
- Preserve existing callback names, data shapes, route IDs, local-storage keys, and API response contracts unless the task explicitly requires a migration.
- For dialogs, use the shared `Modal`/`ConfirmDialog` primitives. Support Escape and backdrop dismissal consistently, and prevent clicks inside the dialog from closing it.
- For dropdowns, popovers, drawers, and notification panels, handle outside clicks, keyboard interaction, focus visibility, and mobile sizing.
- Prefer real loading, empty, and error states. Never add fake data or silently swallow failures to make a screen appear complete.
- Destructive actions require clear confirmation and must not remove secrets, environment files, credentials, or user data without explicit scope.

## Accessibility and responsive UI

- Use semantic elements (`button`, `nav`, `main`, `header`, `dialog` patterns where appropriate) instead of clickable `div`s.
- Every icon-only button needs an accessible name. Set `aria-current`, `aria-expanded`, `aria-pressed`, or `aria-live` where the interaction requires it.
- Keep visible `:focus-visible` states. Do not remove outlines without providing an equally clear focus indicator.
- Ensure form controls have labels or an accessible name, and associate validation messages with the relevant field.
- Design from the existing breakpoints, especially the mobile navigation drawer and compact content layout around 768px and 520px/640px. Check narrow widths down to the supported 320px minimum.
- Respect `prefers-reduced-motion`; animations must not be required to understand or complete an interaction.

## Verification

From `website/`, run the checks relevant to the change before declaring completion:

```text
npm run lint
npm run build
npm test
```

For visual or interaction changes, also inspect the affected screen in light and dark themes at desktop and mobile widths. If a check cannot run, report the exact command and reason.

## Change discipline — Tiered read (do not brute-scan)

- **Do not reread all files.** Trust `PROJECT_MAP.md` + root `context.md` snapshot; locate files via the maps, then `Grep` with `include` + `Read` only the 1–2 targets.
- Read the affected page, shared components, and corresponding CSS before editing.
- Make the smallest coherent change and remove unused imports, dead code, and temporary styles introduced during the work.
- Do not edit generated Android output, build artifacts, screenshots, or assets unless the task specifically targets them.
- Never modify or delete `.env` files or secrets. Use `website/.env.example` only for documenting non-secret variable names when explicitly requested.
