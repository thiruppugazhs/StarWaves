# ADR 0034 — Avatar modeling studio with managed project assets

## Status

Accepted

- Date: 2026-09-06
- Deciders: Starwaves maintainers
- Tags: `frontend`, `threejs`, `modeling`, `workspace-storage`

## Context

Avatar Studio previously focused on previewing Eve models and saving avatar
preferences. The requested workspace needs scene selection, transforms,
materials, animation data, import/export, and project reopen. Existing
`workspace-files` requests are intentionally capped for code and text files,
while model binaries and GLTF dependency sets can be much larger.

The frontend already owns Three.js and VRM loading capabilities, and the
backend already has authenticated per-user workspace storage. Introducing a
second persistence system or embedding binaries in scene JSON would make
projects difficult to reopen and would bypass existing ownership boundaries.

## Decision

- Replace `/app/avatar` with a focused modeling workspace composed of React
  editor panels and a shared Three.js viewport.
- Keep scene data as versioned JSON containing model references, nodes,
  transforms, materials, animations, and camera framing.
- Add `/modeling/projects` routes backed by a dedicated repository under the
  authenticated workspace storage path. Store versions as JSON and model
  binaries as individually validated assets.
- Use multipart uploads for assets and authenticated streaming downloads. Keep
  `workspace-files` unchanged for ordinary workspace content.
- Use Three.js loaders, controls, and GLTFExporter; preserve existing VRM
  loading and reject unsupported VRM export cases instead of mislabeling GLB
  output as VRM.
- Share the React editor between browser and Tauri. Browser-compatible blob
  import/export is the baseline; native dialogs remain an enhancement.

## Consequences

- **Positive:** projects are reopenable, binary assets are not forced through
  text-file limits, and model editing remains in the existing frontend stack.
- **Negative / Cost:** storage remains unavailable in serverless mode until an
  object-storage repository is introduced; the editor needs explicit schema
  version migration as scene capabilities grow.
- **Follow-up:** add a VRM-aware exporter and object-storage adapter after the
  first scene/GLB milestone is validated.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Embed model binaries in scene JSON | Exceeds workspace request limits and bloats every version. |
| Reuse avatar upload records only | Does not preserve scene edits, versions, or project ownership boundaries. |
| Add a new frontend state framework | Existing React reducer/context patterns are sufficient. |

## References

- `website/src/pages/avatar-studio/ModelingStudioWorkspace.jsx`
- `server/app/api/routes/modeling.py`
- `server/app/repositories/modeling_projects.py`
