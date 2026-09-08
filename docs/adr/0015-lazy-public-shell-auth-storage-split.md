# ADR 0015 — Break request/authApi cycle and lazy-load public shell

## Status

Accepted

- Date: 2026-09-04
- Deciders: build optimization pass
- Tags: `frontend`, `vite`, `code-splitting`, `auth`

## Context

`npm run build` emitted `[INEFFECTIVE_DYNAMIC_IMPORT]`: `src/lib/request.js`
dynamically imported `src/lib/authApi.js` for 401 cleanup, while `request.js`
also statically imported token/device helpers from the same module — and
`authApi.js` imports `apiRequest` back from `request.js`. The cycle made the
dynamic import useless (module was always in the initial chunk) and kept the
full auth/OAuth module in the critical path of every API call.

Separately, `App.jsx` eagerly imported all public pages (`LandingPage` with
framer-motion, `AuthPage`, `OnboardingPage`, …) plus the global avatar
companion host, inflating the initial `index` chunk to ~248 kB even for
authenticated `/app/*` sessions that never render those routes.

## Decision

- New `website/src/lib/authStorage.js`: pure localStorage/device helpers with
  zero imports. `authApi.js` re-exports them (existing call sites unchanged)
  and imports what it needs internally.
- `request.js` imports statically from `./authStorage` only; the 401 handler
  calls `clearAuthSession()` directly — the dynamic `import('./authApi')` is
  removed, so the warning is gone and no cycle remains.
- `App.jsx`: `AuthPage`, `ForgotPasswordPage`, `OnboardingPage`,
  `LandingPage`, `PrivacyPolicyPage`, `TermsOfServicePage`, `CustomPage`, and
  `EveGlobalCompanionHost` become `React.lazy`; public early-returns render
  inside `publicRoute`'s `Suspense` (`WaveLoader` fallback), the companion
  mounts under `Suspense fallback={null}`.
- `vite.config.js`: `monaco-editor` explicitly maps to the `monaco` chunk;
  comments now document that `avatar-3d`/`avatar-live2d`/`motion` are
  lazy-only and that the shared lucide chunk is intentional (180 tree-shaken
  named icons, cached once). No `chunkSizeWarningLimit` change.

## Consequences

- **Positive:** ineffective-dynamic-import warning gone; `index` 247.7 →
  152.0 kB (−39%); `authApi` chunk 12.7 → 6.4 kB; `motion` (133.6 kB) now
  loads only with the landing route. No API, route, UI, or auth-behavior
  change — 401 still clears the session and fires `starwaves:session-revoked`.
- **Negative / Cost:** one extra tiny module (`authStorage`); public routes
  show `WaveLoader` briefly on first visit (same loader as auth-gating).
- **Follow-up:** none required; avatar chunks (>600 kB) stay large but are
  genuinely lazy feature chunks.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep dynamic import, remove static one | Token/device headers are needed synchronously on every request; async would complicate all call sites. |
| Lazy-load everything incl. AppLayout/calls overlay | Tiny shell components; lazy-loading them adds Suspense churn for negligible gain. |
| Per-icon lucide splitting | Would create hundreds of tiny chunks; shared hashed chunk is downloaded once and cached. |
| Raise `chunkSizeWarningLimit` | Hides the warning without reducing initial bytes. |

## References

- `website/src/lib/authStorage.js`
- `website/src/lib/request.js:1`
- `website/src/lib/authApi.js:1`
- `website/src/App.jsx:34`
- `website/vite.config.js:21`
