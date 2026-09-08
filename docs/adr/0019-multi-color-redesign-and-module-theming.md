# ADR 0019: Multi-Color Redesign, Module Accent Theming, and Monochrome Retirement

- **Status**: Accepted
- **Date**: 2026-09-06
- **Deciders**: Starwaves Core Team
- **Supersedes**: [ADR 0011: Spectrum Color Role System](./0011-spectrum-color-role-system.md)

---

## Context

Starwaves historically mandated a monochrome-first user interface (pure black, white, and grays), with duotone and spectrum palettes only available as opt-in presets while preserving greyscale defaults.

In user experience evaluations and design iterations, the monochrome default lacked visual hierarchy, semantic clarity, and product personality. Different workspace sections (Code Workspace, Studio, Eve AI, WhatsApp, Mail, Calendar) felt uniform and monotone. Users requested transitioning the site from the monochrome design to a vibrant, expressive multi-color design with module-specific accent coding.

## Decision

1. **Retire Pure Monochrome Presets**:
   - Deprecate all 11 pure monochrome presets (`light`, `dark`, `oled`, `graphite`, `charcoal`, `fog`, `silver`, `stone`, `smoke`, `bone`, `gray`).
   - Restructure `PALETTE_GROUPS` into `spectrum` (Multi-Color Spectrum) and `duo` (Vibrant Duotone).

2. **Upgrade Base Semantic Design Tokens**:
   - Base light theme (`website/src/styles/themes/index.css`) and dark theme (`website/src/styles/themes/dark.css`) default directly to vibrant semantic colors:
     - `--color-primary`: Electric Indigo (`#4f46e5` light / `#6366f1` dark)
     - `--color-accent`: Sky Blue (`#0284c7` light / `#38bdf8` dark)
     - `--color-success`: Emerald Green (`#059669` light / `#10b981` dark)
     - `--color-warning`: Amber (`#d97706` light / `#f59e0b` dark)
     - `--color-danger`: Crimson Rose (`#e11d48` light / `#f43f5e` dark)
     - `--color-purple`: Royal Purple (`#9333ea` light / `#a855f7` dark)

3. **Domain & Module-Level Accent Coding**:
   - Assign signature colors to core navigation groups and prominent communication apps:
     - **Work Group**: Electric Indigo (`#4f46e5`)
       - Workspace: Code Amber (`#d97706` / `#fbbf24`)
       - Todo: Cyan / Teal (`#0891b2` / `#22d3ee`)
       - Projects: Cobalt Blue (`#2563eb` / `#3b82f6`)
       - Documents: Sky Blue (`#0284c7` / `#38bdf8`)
     - **Studio Group**: Vivid Violet (`#7c3aed` / `#a855f7`)
     - **Eve AI Group**: Luminous Iris / Pink (`#db2777` / `#f43f5e`)
     - **Growth Group**: Energetic Emerald (`#059669` / `#10b981`)
     - **Communication Group**: Feature-specific signatures
       - WhatsApp: Brand Emerald Green (`#16a34a` / `#22c55e`)
       - Mail: Rose Red (`#e11d48` / `#fb7185`)
       - Calendar: Sky Blue (`#0284c7` / `#38bdf8`)
       - Calls: Purple (`#9333ea` / `#c084fc`)
       - Chats: Indigo (`#4f46e5` / `#818cf8`)
     - **Account Group**: Slate Indigo (`#475569` / `#94a3b8`)

4. **Dynamic Navigation & Surface Theming**:
   - Sidebar navigation (`Sidebar.jsx`, `sidebar.css`) items dynamically adapt active pills, icon hover highlights, and group headers to their module's signature color.
   - Topbar breadcrumb (`Header.jsx`, `header.css`) features an illuminated module status dot.
   - Dashboard widgets (`DashboardPage.jsx`, `dashboard.css`) and metric cards (`metric-card.css`) feature jewel-toned tinted badges and responsive colored border highlights.
   - Shared `Badge.jsx` primitive is styled with semantic and module-specific color variants (`badge.css`).

5. **Comprehensive Dual Mode (Dark & Light)**:
   - Light mode provides crisp slate surfaces with saturated jewel tones and soft pastel badge tints.
   - Dark mode provides deep obsidian surfaces with luminous glowing borders, neon accents, and tinted glasscards.

## Consequences

### Positive
- Clear visual hierarchy and instant spatial recognition across features and workspace domains.
- Cohesive, polished SaaS aesthetic replacing sterile greys.
- Strict backwards compatibility for cached user customizer states through automatic fallback migration.

### Trade-offs
- Pure monochrome is no longer offered out-of-the-box. Users can still customize individual color variables via the UI Customization Studio.

## Alternatives Considered

- **Keep Monochrome as Default, Add Multi-Color as Theme**: Rejected because the user explicitly requested a complete redesign of the site away from monochrome.
- **Single Brand Color Everywhere**: Rejected during design interview in favor of distinct domain/module accent coding.
