# Avatar Examples — Attribution

Bundled example models for Eve Avatar (ADR 0012). Real rendering via `three` + `@pixiv/three-vrm` (VRM) and `pixi.js` + `pixi-live2d-display` (Live2D Cubism 4). Procedural fallback renders when assets are stubbed.

## VRM (3D) — `three` + `GLTFLoader` + `VRMLoaderPlugin` + `VRMUtils` — **anime default downloaded**

- `vrm/eve-anime.vrm` — **Anime VRM 10.28 MB** (`VRM1_Constraint_Twist_Sample.vrm` from `pixiv/three-vrm@dev`, via `cdn.jsdelivr.net/gh/pixiv/three-vrm`) — real humanoid rig + `VRMC_vrm` blendShapes, `VRMUtils.removeUnnecessaryVertices` + `combineSkeletons`, `humanoid.getNormalizedBoneNode('head')` lookAt. Single unique VRM entry (former mono/duo tint duplicates removed; theme tint still applies via CSS). Previously `Box.glb` 1664b placeholder; now replaced.
- `scripts/fetch-avatar-models.ps1` and `scripts/generate-default-vrm.mjs` kept for regeneration.

## Live2D (Cubism) — `pixi.js` 7 + `pixi-live2d-display/cubism4` — **anime default downloaded**

- `live2d/haru/haru_greeter_t03.model3.json` + `haru_greeter_t03.moc3` (0.37MB) + `haru_greeter_t03.2048/texture_00.png` (1.46MB) + `texture_01.png` (1.13MB) + `physics3.json` + `pose3.json` + `motion/` (5 Idle/Tap `.motion3.json`) + `expressions/` (8 `.exp3.json`) — **Haru Greeter anime Live2D** (from `guansss/pixi-live2d-display/test/assets/haru`, via `cdn.jsdelivr.net`) — real `ParamMouthOpenY`/`ParamEyeLOpen/R`/`ParamAngleX/Y`/`ParamBodyAngleX` driven by `Live2DModel.jsx`. No `cdi3.json` upstream (optional metadata, loads without it); Tap sounds skipped (optional).
- `live2d/haru/Haru.model3.json` — minimal stub (kept on disk for manual testing, not listed — loader falls back gracefully).
- `live2d/unitychan/unitychan.model3.json` — UnityChan (UnityChan License) stub (kept on disk, not listed — textures absent so it falls back).
- `../live2d/live2dcubismcore.min.js` — Live2D Cubism 4 runtime core (© Live2D Inc., marked Redistributable Code, from `cubism.live2d.com/sdk-web/cubismcore/`) — **required** by `pixi-live2d-display/cubism4`; without it every Live2D model falls back. Preloaded in `index.html`, re-injected on demand by `Live2DModel.jsx` if the preload missed.

## Adding your own

- VRM: VRoid Studio → `.vrm` → `public/avatars/vrm/` (served at `/avatars/vrm/...`)
- Live2D: Cubism Editor → `.model3.json` + `*.moc3` + textures → `public/avatars/live2d/<name>/`
- Upload via Settings → Eve avatar → Upload (validates `.vrm/.glb/.model3.json/.zip`, max 12MB, zip must contain one `model3.json`, no `..` traversal). Per-user in `WORKSPACE_STORAGE_PATH/avatars/{uid}/`.

Stubs are 12-byte `glTF` magic or minimal `model3.json` so `HEAD` probe succeeds and `VrmModel`/`Live2DModel` mount real `WebGL`/`PIXI.Application` with ResizeObserver.
