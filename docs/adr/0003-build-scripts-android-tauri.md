# ADR 0003 — Build Scripts for Android (Capacitor) + Desktop EXE (Tauri)

## Status

Accepted

- Date: 2026-08-31
- Deciders: @susindran
- Tags: `build`, `android`, `tauri`, `capacitor`

## Context

Starwaves had half-wired shells: `website/android/` (Capacitor 8.4.2, Gradle 8.13, compileSdk 36) built only via manual `.\gradlew assembleDebug`; `website/src-tauri/` (Tauri 2.0) had no `@tauri/cli`, no `bundle`, no signing. Package.json `cap:build` was Windows-only debug. No single-command, reproducible build existed for teammates/CI, and `VITE_API_URL` env injection at build time was ad-hoc (.env vs .env.android confusion). AGENTS.md requires thin routes, DRY, and no temp hacks — we need a proper build layer, not inline workarounds.

## Decision

Add cross-shell build scripts at repo root `scripts/` (matching existing `scripts/` deploy convention) rather than `website/scripts/`:

- `scripts/build-android.ps1` + `.sh` — Node/Java/SDK checks, version sync `package.json → app/build.gradle (versionCode bump, versionName)`, `vite build + cap sync`, `gradlew assembleDebug|assembleRelease|bundleRelease`, manifest `android.json` generation, optional `-Publish` via `scp` to backend.
- `scripts/build-desktop.ps1` + `.sh` — Node/Rust/cargo checks, `VITE_API_URL` shadow copy to `website/.env`, icon generation via `tauri icon`, `vite build`, `tauri build (--debug)` with signing via `TAURI_SIGNING_PRIVATE_KEY` env, artifact collection (`msi/nsis.exe + .sig + latest.json`), optional publish.
- `scripts/build-ota.ps1/.sh` — zip `dist` → `bundles/<id>.zip` + `bundles/latest.json` for Capgo/self-host.
- `scripts/build-all.ps1/.sh` — orchestrator.
- `scripts/lib/common.ps1` — shared `Assert-Command`, `Import-EnvFile`, `Get-PackageVersion`, SHA, etc.

Package.json augments: `android:sync`, `android:build:debug|release|bundle`, `tauri:dev|build|build:debug`; bump version `0.0.0→0.1.0`; define `__APP_VERSION__` via vite; add dev ` @tauri/cli` and optional ` @capgo/capacitor-updater`, `@tauri-apps/plugin-updater/process/dialog`.

Tauri config: add `bundle {targets:[msi,nsis], icon, createUpdaterArtifacts:v1Compatible}` and `plugins.updater` endpoint pointing at backend (`/api/v1/updates/latest.json`). Cargo adds `tauri-plugin-updater/process`. Generated icons from `public/starwaves-logo.png`.

Android gradle: `versionName` derived from `package.json`, `versionCode` monotonic (reads prior `android.json` to avoid collision). `gradle.properties` `java.home` made overridable via `-Dorg.gradle.java.home` or `JAVA_HOME`.

All keys in env, never committed. `latest.json`/`android.json` on backend are source of truth.

## Consequences

- **Positive:** One-command `.\scripts\build-android.ps1 -BuildType release` and `.\scripts\build-desktop.ps1 -BuildType release` reproducible locally/CI. Version single-source (`package.json`). Backend-hosted artifacts enable signed updater (0004). Scripts fail-fast with hints (missing java, sdk, rust). `vite build` env shadow avoids polluted `.env`.
- **Negative / Cost:** Requires Rust toolchain for desktop, Android SDK for Android. `local.properties` absolute `sdk.dir` machine-specific remains; scripts now generate from `ANDROID_HOME` if missing but not yet fully hermetic.
- **Follow-up:** CI workflow `release.yml` to call same scripts; Play Store `app-update` plugin if ever publishing to Play; Tauri `icon.ico` proper conversion via `tauri icon` (placeholder copied).

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| npm scripts only (no `scripts/`) | Complex prereq checks/env not ergonomic in JSON |
| GitHub Releases as hosting | Rejected per product decision — backend preferred (VM Nginx) |
| Electron instead of Tauri | Tauri already scaffolded, smaller bundle, watcher via `notify` |
| Fastlane for Android | Overkill for single-variant APK; Gradle wrapper sufficient |

## References

- `website/package.json:6` scripts, `website/src-tauri/tauri.conf.json`, `website/src-tauri/Cargo.toml`, `website/android/app/build.gradle`, `scripts/build-desktop.ps1`, `scripts/build-android.ps1`
- AGENTS.md §1.7, PROJECT_MAP.md top-level `scripts/`
