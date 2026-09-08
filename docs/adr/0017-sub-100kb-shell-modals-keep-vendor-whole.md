# ADR 0017 — Sub-100 kB pass: defer shell modals, keep single-purpose vendor chunks whole

## Status

Accepted

- Date: 2026-09-04
- Deciders: build optimization pass (follow-up to ADR-0015/0016)
- Tags: `frontend`, `vite`, `code-splitting`

## Context

Every chunk over 100 kB was audited for a further split: `index` (152),
`vendor` (178), `motion` (134), `vrm-loader` (188), `pixi` (220),
`live2d` (388), `lucide-react` (469), `three-core` (500). Two attempted
splits were measured and then reverted: vendor react/react-dom separation
saved zero bytes while adding a request and odd cross-chunk edges, and an
importer-based icons-core/icons-lazy split classified every icon as initial.

## Decision

- `Header.jsx`: `EveAssistantModal` and `AdvancedSearchModal` become
  `React.lazy`, mounted gated behind `eveOpen`/`searchOpen` in
  `Suspense fallback={null}`. Both return `null` when closed with effects
  gated on `isOpen`, so conditional mounting preserves behavior (no exit
  animations exist to break). This defers the Eve modal, the search index
  (`config/search*`, only used by the search modal), and the Markdown
  renderer out of the initial shell: `index` 152 → 107 kB.
- `vendor` stays one chunk (react + react-dom + scheduler are
  version-locked and always co-loaded; splitting saved 0 bytes).
- `icons` stays one explicitly-named chunk: lucide-react@1.26.0 ships no
  per-icon ESM (`dist/esm` holds only sourcemaps, the `module` entry is
  missing), so the bundler falls back to the single-file CJS build — one
  module id, nothing to split by importer. Content is tree-shaken to the
  ~180 used icons. Per-icon chunks require a lucide version with intact
  ESM output (proposed follow-up, needs dependency approval).
- `motion`, `pixi`, `live2d`, `three-core`, `vrm-loader`, `grid`, `monaco`
  stay whole: each is already a single-purpose module at its natural
  boundary (three/three-vrm ship as single-file bundles; pixi's global is
  load-bearing per ADR-0016). Splitting a library internally only adds
  bytes and round trips. `chunkSizeWarningLimit` unchanged.

## Consequences

- **Positive:** initial `index` −45 kB; new deferred chunks
  `EveAssistantModal` (13.6 kB) and `AdvancedSearchModal` (26.0 kB, incl.
  search index) load on first open; build has zero warnings; no UI, route,
  API, modal, or auth-behavior change.
- **Negative / Cost:** chunks over 100 kB remain where the bytes are
  inherent to the library (see Alternatives); icons still ship 469 kB
  initial until the lucide ESM follow-up.
- **Follow-up:** upgrade or pin a lucide-react version whose `dist/esm`
  contains per-icon modules, then re-apply importer-based
  icons-core/icons-lazy splitting (prototype existed, classification was
  the only blocker — with per-icon ids it works).

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Split react/react-dom/scheduler | Measured: 178.31 → 174.81 + 3.56 kB, zero bytes saved, extra request, confusing chunk graph. Reverted. |
| Importer-based icons-core/icons-lazy | Single CJS module id — every icon classified identically. Impossible without lucide ESM fix. Reverted. |
| Split three/pixi/motion internally | Single-file bundles / single purpose; only adds bytes and waterfall round trips. |
| Lazy-load Sidebar/layout | Needed for first paint; would cause layout shift. |

## References

- `website/src/components/Header.jsx:1`
- `website/src/components/EveAssistantModal.jsx:319`
- `website/src/components/search/AdvancedSearchModal.jsx:284`
- `website/vite.config.js:21`
