# ADR 0011: Spectrum Color Role System (Supersedes Strict Monochrome Rule)

- **Status**: Superseded by [ADR 0019](./0019-multi-color-redesign-and-module-theming.md)
- **Date**: 2026-09-01
- **Deciders**: Starwaves Core Team

---

## Context

Starwaves originally mandated a strict **Monochrome Design System** (black, white, and gray tonal scales), supplemented by 12 duotone presets where each theme paired a neutral canvas with a single accent hue.

The requirement has evolved to support rich, distinctive color themes while preventing visual chaos and maintaining clean visual hierarchy:
1. The user requested removing the strict monochrome-only mandate across the site for colored themes.
2. The core new design constraint is: **"Site is going to use different colors and site does not use color more than once on screen. Only one element/role can have that color."**
3. The original core themes — **Light mode (`light`), Dark mode (`dark`), and Stone Grey (`stone`)** — must be preserved without modifications.

## Decision

We introduce the **Spectrum Color Role System** (`palette: 'spectrum'`) alongside the existing `mono` and `duo` palettes:

1. **Role-Based Unique Hue Assignment**:
   In Spectrum themes, each semantic and interactive token is assigned a distinct hue from a curated harmonious palette:
   - `--color-primary`: Primary action button / main active element
   - `--color-accent`: Secondary highlight / navigation indicators / links
   - `--color-success`: Success tags / completed states
   - `--color-warning`: Warnings / pending states
   - `--color-danger`: Errors / destructive actions
   - `--color-purple`: Special category badges / AI markers
   - `--scrollbar-thumb`: Scrollbar tracking accent
   No two semantic token roles share the same hue in a Spectrum theme.

2. **Canvas and Text Neutrality**:
   Backgrounds, cards, typography, and borders maintain high-contrast neutral foundations (off-white for light modes, deep charcoal/obsidian for dark modes) so that role colors pop without overwhelming readability.

3. **Preservation of Core Mono Themes**:
   `index.css` (Default Light), `dark.css` (Default Dark), and `stone.css` (Stone Grey) remain untouched and available in the `mono` palette group.

4. **Initial Spectrum Presets**:
   - `prism`: Crisp light spectrum theme with distinct jewel-toned role hues.
   - `neon-grid`: High-contrast dark cyber spectrum theme with vivid neon role markers.
   - `botanical`: Organic deep-forest dark theme with earthy botanical role colors.

## Consequences

### Positive
- Rich visual expressiveness while maintaining strict design discipline and no clutter.
- Clear semantic separation where color directly aids cognitive recognition of UI roles.
- Backwards-compatible: existing users preferring pure monochrome or duo themes retain `light`, `dark`, and `stone`.

### Negative / Trade-offs
- Adding new Spectrum themes requires deliberate color harmony planning to ensure each of the 7+ roles has sufficient contrast against the background and remains distinct from other role hues.

## Alternatives Considered

- **Unrestricted Multi-color**: Rejected as it leads to inconsistent branding and messy interfaces.
- **Replacing all Mono themes**: Rejected because the clean minimalist monochrome aesthetic is a core preference for many workflows.
