# Starwaves — Build Guide (Android + Desktop)

One-command builds for Android APK/AAB (Capacitor) and Windows EXE (Tauri), with backend-hosted auto-update.

## Prereqs

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org (npm 10) |
| Java | 17 or 21 | Temurin https://adoptium.net or Android Studio JBR (`C:/Program Files/Android/Android Studio/jbr`) |
| Android SDK | 36 (compileSdk) | Android Studio → SDK Manager → Android 36 + build-tools |
| Rust | 1.77+ | https://rustup.rs → `rustup target add x86_64-pc-windows-msvc` |
| `ANDROID_HOME` | env | Point to SDK e.g. `C:\Users\you\AppData\Local\Android\Sdk` or rely on `website/android/local.properties` |
| Optional `TAURI_SIGNING_PRIVATE_KEY` | — | For signed desktop releases (see § Signing) |
| Optional Capgo | — | `npm i @capgo/capacitor-updater` already optionalDependency |

Verify:

```powershell
node -v; npm -v; java -version; cargo --version; rustc --version; npx --prefix website tauri --version
echo $env:ANDROID_HOME
```

## Env Files

- `website/.env` → local dev (`VITE_API_URL=http://127.0.0.1:8000/api/v1`)
- `website/.env.android` → prod Android (`VITE_API_URL=https://api.starwaves.susindran.in/api/v1`)
- `website/.env.prod` → desktop prod (same URL)
- `server/.env` / `.env.prod` → backend; relevant: `API_BASE_URL`, `UPDATES_DIR`, `UPDATER_SECRET`, `TAURI_SIGNING_PUBLIC_KEY`

`VITE_API_URL` is baked at `vite build` time. Build scripts shadow `website/.env` temporarily then restore.

## Android (Capacitor)

**Debug (fast, unsigned):**
```powershell
.\scripts\build-android.ps1 -BuildType debug
# outputs: website/android/app/build/outputs/apk/debug/app-debug.apk
adb install -r website/android/app/build/outputs/apk/debug/app-debug.apk
```

**Release (signed if keystore present) + publish manifest:**
```powershell
$env:ANDROID_KEYSTORE_PATH="C:\keys\starwaves.keystore"
$env:ANDROID_KEYSTORE_PASSWORD="..."
$env:ANDROID_KEY_ALIAS="starwaves"
$env:ANDROID_KEY_PASSWORD="..."
.\scripts\build-android.ps1 -BuildType release -Bundle apk -Publish -RemoteHost api.starwaves.susindran.in
# creates server/static/updates/android.json + starwaves-0.1.0.apk and scp if -Publish
```

- `versionName` from `website/package.json.version`; `versionCode` monotonic (+1 each release, checks `android.json` to avoid collision).
- If no keystore → unsigned APK (`app-release-unsigned.apk`) — still installable after enabling *Install unknown apps* but updater prompt uses same file.
- To create keystore: `keytool -genkeypair -keystore website/android/app/release.keystore -alias starwaves -keyalg RSA -keysize 2048 -validity 10000`
- `Bundle` `apk|aab|both` — `aab` for Play, `apk` for sideload. `Publish` copies to `~/starwaves/server/static/updates/`.

**Bash (WSL/CI):**
```bash
./scripts/build-android.sh debug
PUBLISH=1 REMOTE_HOST=api.starwaves.susindran.in ./scripts/build-android.sh release
```

## Desktop (Tauri)

**Debug (fast, no signing):**
```powershell
.\scripts\build-desktop.ps1 -BuildType debug
```

**Release (signed, MSI+NSIS):**
```powershell
# One-time: generate keys
npx --prefix website tauri signer generate -w $HOME/.tauri/starwaves.key
# pubkey printed → paste into website/src-tauri/tauri.conf.json plugins.updater.pubkey
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $HOME/.tauri/starwaves.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "optionalIfEncrypted"
.\scripts\build-desktop.ps1 -BuildType release -Publish -RemoteHost api.starwaves.susindran.in
# outputs: website/src-tauri/target/release/bundle/{msi,nsis}/*.exe/*.msi +.sig + latest.json
```

- `tauri.conf.json` `bundle.createUpdaterArtifacts=v1Compatible` emits `latest.json` with sigs.
- If `TAURI_SIGNING_PRIVATE_KEY` missing → build still succeeds but updater disabled (warn).
- Icons auto-generated from `public/logo.png` via `npx tauri icon` if `src-tauri/icons/icon.png` missing.
- `Bundler` `msi|nsis|both` (default `both`).

**Bash:**
```bash
./scripts/build-desktop.sh release  # or debug
PUBLISH=1 REMOTE_HOST=api.starwaves.susindran.in ./scripts/build-desktop.sh release
```

## OTA Web Bundle

```powershell
.\scripts\build-ota.ps1 -Publish -RemoteHost api.starwaves.susindran.in
# zips website/dist → server/static/updates/bundles/bundle-0.1.0.zip + latest.json
```
- Requires `@capgo/capacitor-updater` on device to apply; otherwise banner shows but `window.open(url)` fallback.
- OTA check: `GET /api/v1/updates/ota/latest.json`.

## All

```powershell
.\scripts\build-all.ps1 -BuildType release -WithOTA -Publish -RemoteHost api.starwaves.susindran.in
```

## Auto-Update Flow (backend-hosted)

- **Desktop:** App checks `GET /api/v1/updates/latest.json` (or `/check?platform=windows`) on launch + every 6h + Settings → Updates. If `updateAvailable`, banner → Install & Relaunch (Tauri plugin) or download.
- **Android:** App checks `GET /api/v1/updates/check?platform=android&currentVersion=…` on launch/resume + Settings → Updates. Banner → Download APK (Phase 1 browser; Phase 2 native installer). `force:false` always (no blocking).
- **OTA:** `GET /api/v1/updates/ota/latest.json` polled when native; Capgo `download+set` applies.

Backend verification:
```bash
curl http://localhost:8000/api/v1/updates/check?platform=windows&currentVersion=0.0.9
curl http://localhost:8000/api/v1/updates/latest.json
curl http://localhost:8000/api/v1/updates/android.json
curl http://localhost:8000/updates/ | head
curl https://api.starwaves.susindran.in/updates/starwaves-0.1.0.apk --head
```

## Docker & Nginx

- `docker-compose.yml` mounts `./server/static/updates:/app/static/updates` (also in `app.main` mount `/updates → StaticFiles`).
- `nginx.conf` + `conf.d/default*.conf` proxy `location /updates/` → `server_backend` with `burst 60` and CORS `tauri://`/`capacitor://`.
- No extra volume needed; bind mount from host persists artifacts across redeploys.

## CI (suggested)

- `GITHUB_SECRET: TAURI_SIGNING_PRIVATE_KEY, ANDROID_KEYSTORE_BASE64` → decode on runner.
- Steps: `node ci → cargo build → run scripts` → `scp` via `appleboy/ssh-action` as `deploy-gcp.yml` does.

## Troubleshooting

- **gradle java.home error:** Set `$env:JAVA_HOME` to JDK 21 path; script passes `-Dorg.gradle.java.home`.
- **local.properties missing:** Create from `ANDROID_HOME`: `echo "sdk.dir=$env:ANDROID_HOME" > website/android/local.properties`
- **tauri build fails: pubkey empty:** Set `TAURI_SIGNING_PUBLIC_KEY` env or paste pubkey into `tauri.conf.json`.
- **No dist:** Ensure `npm run build` succeeded (check `website/dist/index.html`).
- **Updates 404:** Ensure `server/static/updates/latest.json` exists (committed stub) and Nginx `/updates` proxies.
