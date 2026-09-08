# ADR 0018 — Optimize all: lucide 1.40 ESM, single-pixi override, theme leaf, dead-dep removal

## Status

Accepted

- Date: 2026-09-04
- Deciders: build optimization pass (follow-up to ADR-0015/0016/0017)
- Tags: `frontend`, `vite`, `code-splitting`, `dependencies`

## Context

The remaining chunks over 100 kB were `index` (154), `vendor` (178),
`motion` (134), `vrm-loader` (188), `pixi` (430), `live2d` (369),
`lucide` (469), `three-core` (500). Auditing with a temporary
chunk→module map (since deleted) showed: lucide-react@1.26.0 ships no
per-icon ESM (barrel + CJS fallback only); the npm re-resolution had
silently installed two pixi versions (v6 top-level for live2d peers, v7
nested for pixi.js); and the initial chunk carried the 25 raw theme CSS
strings plus the customizer hook through barrel imports.

## Decision

- `lucide-react` 1.26.0 → 1.40.0 (intact per-icon ESM, compact icon
  format): 469 → 43 kB single `icons` chunk. All 180 used icon names
  still resolve — no import changes needed. Importer-based core/lazy
  splitting was prototyped and rejected: 1.40 funnels imports through a
  barrel, and rewriting 122 files to deep imports to defer ~36 kB is a
  bad trade.
- Removed unimported `@react-three/drei` + `@react-three/fiber` (they
  also blocked every `npm install` via a pre-existing react-19 peer
  conflict). `three` + `@pixiv/three-vrm` stay — actually used.
- `overrides` pin `@pixi/{constants,core,display,math,settings,sprite,
  utils}` to 7.4.3: restores the previously shipped single-v7 runtime
  (cubism classes must match the global v7 `PIXI`) and removes the
  duplicated v6 tree (`qs`, `url`, CJS helpers) from `live2d`.
- New `src/themes/themeApplicator.js` leaf (option tables + apply/reset,
  zero imports); `presets.js` re-exports it. `App.jsx` imports the leaf
  and deep hook modules instead of the `themes`/`hooks` barrels, so the
  preset CSS catalog and customizer hook return to async chunks.
- `motion`, `vendor`, `three-core`, `vrm-loader` stay whole (measured or
  single-file/single-purpose — see ADR-0017); `pixi`/`live2d` keep their
  engine-vs-runtime split.

## Consequences

- **Positive:** `index` 154 → 113 kB; `icons` 469 → 43 kB; `pixi` +
  `live2d` back to 220 + 388 kB on one pixi version; `useThemeCustomizer`
  async again (30 kB); zero build warnings; 35/35 tests pass. No UI,
  route, API, modal, avatar, or theme behavior change.
- **Negative / Cost:** `@pixi/loaders@6.5.10` remains (unimported,
  unbundled); overrides must be revisited if pixi.js or
  pixi-live2d-display is upgraded.
- **Follow-up:** none required. Replacing framer-motion or pixi major
  versions was rejected (behavior risk, no test harness for rendering).

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Per-icon deep imports in 122 files | ~36 kB deferral for huge churn + deep-import fragility. |
| `--legacy-peer-deps` instead of removing drei/fiber | Papers over dead weight; packages are imported nowhere. |
| Splitting motion/three-core internals | Single-file bundles; only adds bytes and round trips. |
| Upgrading pixi to v8 / framer-motion major | Rendering-behavior risk with no visual test harness. |

## References

- `website/package.json` (`overrides`, lucide-react 1.40.0)
- `website/src/themes/themeApplicator.js`
- `website/src/App.jsx:50`
- `website/vite.config.js:21`
