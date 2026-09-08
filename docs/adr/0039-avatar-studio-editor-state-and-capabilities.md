# ADR 0039 — Avatar Studio editor state and capabilities

## Status

Accepted

- Date: 2026-09-07
- Deciders: Starwaves maintainers
- Tags: `avatar-studio`, `three.js`, `state`

## Context

Avatar Studio previously mixed imported model metadata, flat keyframes, viewport state, and UI affordances. That made it possible for controls to suggest functionality that a loaded format could not support, and made save/reload and animation evaluation diverge. The editor also needs one normalized representation for GLB, GLTF, VRM, OBJ, and FBX while retaining the existing filesystem-backed modeling project API.

## Decision

- Use scene schema v2 in `website/src/pages/avatar-studio/sceneModel.js`, with model metadata, hierarchical nodes, materials, animation clips/tracks, camera, and timeline settings.
- Migrate legacy flat keyframes on load through `animationModel.js`; evaluate transform tracks by frame with interpolation.
- Keep a capability registry in `editorCapabilities.js`. Unsupported sculpting, UV editing, and VRM export are disabled or explained instead of rendered as decorative actions.
- Load supported formats through Three.js add-on loaders and group companion files into the existing modeling asset-set boundary.

## Consequences

- **Positive:** selection, transforms, playback, persistence, and export share one contract; format limitations are visible and testable.
- **Negative / Cost:** imported format normalization cannot preserve every format-specific feature, and texture paint persistence is intentionally limited to compatible UV meshes.
- **Follow-up:** add a true VRM-preserving exporter and full sculpt/UV tools only when their implementations are available.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep flat scene state | Cannot represent hierarchy, clips, or capability-specific behavior reliably. |
| Separate state per import format | Duplicates editor behavior and breaks cross-format save/export. |
| Show all tools optimistically | Produces fake interactions and misleading editor state. |

## References

- `website/src/pages/avatar-studio/sceneModel.js`
- `website/src/pages/avatar-studio/animationModel.js`
- `website/src/pages/avatar-studio/editorCapabilities.js`
