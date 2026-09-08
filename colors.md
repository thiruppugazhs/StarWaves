# StarWaves Colors & Type

> Design-system reference. Single source of truth is `website/src/styles/tokens.css`
> (+ `styles/themes/dark.css` for dark values). Consume everything via `var(--…)`;
> never hardcode hex in components. See `AGENTS.md` §4.6.2-item-5 and ADR 0022.

## 1. Brand

| Role | Dark (Crimson Noir, default) | Light |
|---|---|---|
| Primary | `#a83b59` (maroon) | `#4f46e5` (indigo) |
| Primary hover / focus | `#c75a73` (dusty rose) | `#4f46e5` |
| Primary tint (bg) | `rgba(168, 59, 89, 0.16)` | — |
| Accent | `#c75a73` | `#0284c7` (sky) |
| Success | `#22c55e` | `#059669` |
| Warning | `#f59e0b` | `#d97706` |
| Danger | `#f43f5e` | `#e11d48` |
| Danger tint (bg) | `rgba(244, 63, 94, 0.16)` | — |
| Purple | `#a855f7` | `#9333ea` |
| Text on colored fills | `#ffffff` (`--on-fill`, both themes) | `#ffffff` |

## 2. Surfaces & text

| Token | Dark | Light |
|---|---|---|
| `--bg-primary` (canvas) | `#0d080a` | `#f4f4f5` |
| `--bg-secondary` | `#1a0f13` | — |
| `--bg-tertiary` | `#24121a` | — |
| `--bg-card` | `#2e1823` | `#fafafa` |
| `--bg-hover` | `#3a1f2c` | — |
| `--text-primary` | `#f8f9fa` | `#09090b` |
| `--text-secondary` | `#b6a9b0` | `#52525b` |
| `--text-muted` | `#7a6a73` | `#71717a` |
| `--border-color` | `#542033` | `#e2e8f0` |
| `--border-focus` | `#c75a73` | — |

## 3. Module accents (one hue per feature)

| Module | Dark | Light | Used for |
|---|---|---|---|
| `--module-work` | `#6366f1` | `#4f46e5` | Dashboard, Home |
| `--module-workspace` | `#fbbf24` | `#d97706` | Code workspace |
| `--module-todo` | `#22d3ee` | `#0891b2` | Tasks |
| `--module-projects` | `#3b82f6` | `#2563eb` | Projects |
| `--module-documents` | `#38bdf8` | `#0284c7` | Documents |
| `--module-studio` | `#a855f7` | `#7c3aed` | Studio |
| `--module-eve` | `#f43f5e` | `#db2777` | Eve AI |
| `--module-growth` | `#10b981` | `#059669` | Jobs, Compete |
| `--module-whatsapp` | `#22c55e` | `#16a34a` | WhatsApp |
| `--module-mail` | `#fb7185` | `#e11d48` | Mail |
| `--module-calendar` | `#38bdf8` | `#0284c7` | Calendar |
| `--module-calls` | `#c084fc` | `#9333ea` | Calls |
| `--module-chats` | `#818cf8` | `#4f46e5` | Team Chats |
| `--module-account` | `#94a3b8` | `#475569` | Profile, Settings |

Each has a `-light` tint twin, e.g. `--module-eve-light: rgba(244, 63, 94, 0.16)`.

## 4. Gradients, glows, shadows

| Token | Dark | Light |
|---|---|---|
| `--gradient-primary` | `#6e1f35 → #a83b59` | `#4f46e5 → #7c3aed` |
| `--gradient-eve` | `#db2777 → #f97316` (both) | same |
| `--gradient-studio` | `#7c3aed → #db2777` (both) | same |
| `--glow-primary` | `0 0 24px rgba(168, 59, 89, 0.4)` | `0 0 20px rgba(79, 70, 229, 0.25)` |
| `--shadow-sm / -md / -lg` | black `0.4 / 0.5 / 0.7` alpha | black `0.05 / 0.08 / 0.16` alpha |
| `--shadow-focus` | `0 0 0 3px rgba(168, 59, 89, 0.35)` | `0 0 0 3px rgba(0, 0, 0, 0.05)` |

Chart series: `--chart-1..6` (`#3b82f6, #22c55e, #a78bfa, #f59e0b, #ef4444, #06b6d4`).
Heatmap: `--heat-1..4` (`#93c5fd → #1d4ed8`). Tooltips: `--tooltip-bg #171717`.

## 5. Design patterns

- **Module edge:** active cards/widgets get a 2px top gradient hairline
  (`transparent → var(--module-*) → transparent`) or an inset side edge
  (`box-shadow: inset 3px 0 var(--module-*)`) for list rows and active states.
- **Tint, don't remix:** translucent fills use
  `color-mix(in srgb, var(--token) X%, transparent)` — never hand-mixed `rgba()`.
- **Glow on primary actions only:** gradient submit buttons + Eve accents carry
  `var(--glow-primary)`; everything else stays flat.
- **Pinned scopes:** landing (`.cinema`) and auth (`.auth-cinematic`) pin Crimson
  Noir values even in light app theme — the documented exception.
- **Motion:** `--transition-fast 140ms / -normal 200ms / -slow 300ms`
  (user-overridable via theme motion setting); page-enter is fade + 10px rise;
  everything freezes under `prefers-reduced-motion`.
- **Radii:** `--radius-xs 4 / -sm 6 / -md 9 / -lg 12 / -xl 16 / -full 999px`.
  **Spacing:** 8pt scale `--space-3xs (4px)` → `--space-3xl (48px)`.
- **Density:** card padding `clamp(16px, 1.8vw, 22px)`, section gap
  `clamp(20px, 2.4vw, 32px)`, content max 1440px.

## 6. Typography

- **Font:** Inter (300–900 via Google Fonts) — `--font-family: 'Inter', sans-serif`.
  System-UI, Roboto, Jakarta, Outfit, Fira Code selectable in theme settings.
- **Scale:** `--text-2xs 10px · xs 11px · sm 12px · base 13px · md 14px ·
  lg 16px · xl 18px · 2xl 20px · 3xl 24px · 4xl clamp(26px, 3vw, 32px)`.
- **Weights:** regular 500 · medium 600 · semibold 700 · bold 800.
  Body 13px/500 · headings 800 with `-0.02em – -0.05em` tracking ·
  kickers/eyebrows 10–11px/800/uppercase/`0.08em–0.12em` tracking.
- **Line-height:** tight 1.15 · normal 1.5 · relaxed 1.65.
