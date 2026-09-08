# ADR 0016 — Modular avatar engine chunks (three-core/vrm-loader/pixi/live2d)

## Status

Accepted

- Date: 2026-09-04
- Deciders: build optimization pass (follow-up to ADR-0015)
- Tags: `frontend`, `vite`, `code-splitting`, `avatar`

## Context

After ADR-0015 the build was clean except one notice: `avatar-3d` (682 kB)
and `avatar-live2d` (606 kB) exceeded the 600 kB chunk limit. Both are lazy
and never in the initial bundle, but each was a monolith: `VrmModel.jsx` used
`import * as THREE` plus static `GLTFLoader` + `@pixiv/three-vrm` imports, so
the model parser/plugin downloaded together with the placeholder scene;
`pixi.js` and `pixi-live2d-display` were likewise fused. Staged loading and
finer cache granularity were impossible.

## Decision

- `VrmModel.jsx`: namespace import replaced with named `three` imports
  (tree-shakeable; `three.module.js` is a single ESM file with
  `sideEffects` limited to `examples/jsm/nodes`). `GLTFLoader` and
  `@pixiv/three-vrm` move into a module-cached `ensureVrmLoader()`
  dynamic import inside the URL-load path only, with an unmount/URL-change
  cancellation guard and a graceful CSS-fallback if the runtime fails.
- `Live2DModel.jsx`: intentionally untouched — `window.PIXI = mod` is
  load-bearing (`cubism4.es.js` reads `window.PIXI.Ticker`), matching the
  documented pixi v7 + pixi-live2d-display pattern.
- `vite.config.js`: `avatar-3d` splits into `three-core` (engine/scene) +
  `vrm-loader` (GLTF addon + three-vrm plugin); `avatar-live2d` splits into
  `pixi` (engine) + `live2d` (display/cubism runtime). Ordering guards the
  substring overlaps (`three-vrm`/`three/examples` contain `three`;
  `pixi-live2d-display` contains `pixi`).

## Consequences

- **Positive:** all chunks < 600 kB — the size notice is gone with zero
  warnings; `vrm-loader` (188 kB) downloads only when a model URL actually
  loads instead of with the placeholder scene; each engine caches
  independently. No UI, route, API, or avatar-behavior change.
- **Negative / Cost:** total avatar bytes ~1,296 kB vs ~1,288 kB (+8 kB
  chunk-boundary overhead); one extra network round-trip in the waterfall
  when a heavy model loads (engines were never on the initial path anyway).
- **Follow-up:** none. CDN-loading the engines (like monaco) or swapping
  pixi v7 / three-vrm versions were rejected as out of scope.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Remove `window.PIXI` to tree-shake pixi | Breaks `pixi-live2d-display/cubism4` at runtime (reads `window.PIXI.Ticker`). |
| CDN ESM imports for three/pixi | Runtime CDN dependency (offline/CSP/version risk); needs user approval. |
| Keep two monolith chunks | Leaves the only remaining >600 kB warning in place. |
| Per-module three/pixi splitting | Hundreds of tiny chunks; 4 feature chunks is the right granularity. |

## References

- `website/src/components/eve/avatar/VrmModel.jsx:1`
- `website/src/components/eve/avatar/Live2DModel.jsx:6`
- `website/vite.config.js:21`
- ADR-0015 (`0015-lazy-public-shell-auth-storage-split.md`)
