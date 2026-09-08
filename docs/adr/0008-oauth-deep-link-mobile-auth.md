# ADR 0008 — OAuth Deep-Link for Native + Mobile Login Layout

## Status

Accepted

- Date: 2026-08-31
- Deciders: @susindran
- Tags: `oauth`, `capacitor`, `tauri`, `deep-link`, `auth`, `responsive`

## Context

Login via Google OAuth opened the system browser then redirected to `http://127.0.0.1:8000/api/v1/auth/google/callback` → `http://localhost:5173/` — both dead on device. WebView is blocked by Google (disallowed_useragent), so OAuth must use system browser (Chrome Custom Tab / Tauri shell.open) and return via deep link. Meanwhile `AuthPage` used a 2-col grid `minmax(360px,0.8fr) minmax(520px,1.2fr)` with 13px inputs, no `safe-area`, causing horizontal scroll at 768 and iOS zoom at <16px. Native apps also showed the marketing landing at `/` while unauthenticated, expecting login.

## Decision

- **Backend deep-link:** `server/app/api/routes/auth/oauth.py` accepts `?platform=android|tauri|web` (+ `origin`). State now carries `platform`, `did`, `dname`. On callback, if `platform==android` → `302 com.starwaves.app://auth?token=…#token=…`; if `tauri` → `302 app.starwaves.workspace://auth?token=…`; if `target_origin` is a native scheme, echo back to that origin with token. Otherwise keep HTML `postMessage` flow for web. Added `settings.native_app_scheme_android/tauri` envs, extended `core/cors.py` and `nginx.conf` allowlists for `com.starwaves.app://` and `app.starwaves.workspace://`, `tauri://`, `capacitor://`.
- **Frontend native auth:** `website/src/lib/authApi.js` now detects `Capacitor.isNativePlatform()` / `window.__TAURI__`, sends `platform`+`origin` to `/auth/google/login`, opens system browser via `@capacitor/browser` (Android) or `@tauri-apps/plugin-shell` (Tauri), and listens for deep-link via `@capacitor/app` `appUrlOpen` + `@tauri-apps/plugin-deep-link` `onOpenUrl` + `getLaunchUrl`. New helpers `consumeAuthTokenFromUrl`, `setupNativeOAuthListeners` auto-close Browser and store token via `setStoredAuthToken`, then navigate to `/app/dashboard`.
- **Capacitor:** `capacitor.config.json` `allowNavigation` for `api.starwaves.susindran.in`, `accounts.google.com`, `github.com`; `AndroidManifest.xml` intent-filter for `com.starwaves.app://auth`, `capacitor://localhost`, `app.starwaves.workspace://auth`; deps `@capacitor/app@8.1.1`, `@capacitor/browser@8.0.4`.
- **Tauri:** `Cargo.toml` `tauri-plugin-deep-link`, `tauri.conf.json` `plugins.deepLink {schemes:["com.starwaves.app","app.starwaves.workspace"]}`, `src/lib.rs` registers `.plugin(tauri_plugin_deep_link::init())`, frontend `optionalDeps` `@tauri-apps/plugin-deep-link`, `@tauri-apps/plugin-shell`.
- **Mobile login layout:** `pages/landing-auth.css` now has `@media 480` polish: `grid 1fr`, `overflow-x:hidden`, `padding safe-area`, `auth-form-shell 100%`, inputs `font-size:16px !important; height:48px` (prevents iOS zoom), buttons `min-height:44px`, reduced brand panel at 480, plus `vite.config` `external` now only `@capgo/` so Tauri plugins bundle.
- **App routing:** `src/App.jsx` `isNativeApp` detection: `route==='/' && isNative && !activeUser` now shows `<AuthPage login>` instead of `<LandingPage>`; web keeps landing.

## Consequences

- **Positive:** Google OAuth works in APK/EXE via system browser → deep link → token stored, no localhost. Login usable at 320px, no zoom, 44px taps, safe-area. Landing skipped on native for faster login.
- **Negative / Cost:** Requires Google Cloud Console `Authorized redirect URIs` to include custom schemes (`com.starwaves.app://auth` etc.) — one-time console edit. Tauri deep-link needs OS registration (handled by `tauri-plugin-deep-link`).
- **Follow-up:** Apply same `platform` pattern to `google-calendar`, `gmail`, `github` integration authorizes; add App Link `assetlinks.json` for universal links; prune `android.json` etc.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep localhost + `adb reverse` | Only works on dev USB, not prod |
| Universal Links only | Needs `assetlinks.json` verification, slower |
| In-WebView OAuth | Google blocks `embedded WebView` user-agent |

## References

- `server/app/api/routes/auth/oauth.py:22`, `server/app/core/config.py:76`, `server/app/core/cors.py:4`, `nginx/nginx.conf:41`, `website/src/lib/authApi.js:207`, `website/capacitor.config.json`, `website/android/app/src/main/AndroidManifest.xml:26`, `website/src-tauri/tauri.conf.json:34`, `website/src-tauri/Cargo.toml:19`, `website/src/App.jsx:72`, `website/src/styles/pages/landing-auth.css:410`
