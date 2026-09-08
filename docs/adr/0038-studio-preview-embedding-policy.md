# ADR 0038 — Scoped Studio Preview Embedding Policy

## Status

Accepted

- Date: 2026-09-07
- Deciders: StarWaves maintainers
- Tags: `studio`, `security`, `preview`

## Context

Studio projects are rendered inside an iframe in the Builder workspace. During local development, the frontend is served from `localhost:5173` while the API serves signed preview documents from `127.0.0.1:8000` (and production uses separate frontend and API hosts). The API-wide security middleware previously applied `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'` to preview HTML, so the browser refused to render the otherwise valid signed preview.

The preview endpoint is already read-only and scoped by a signed, expiring workspace token. The fix must preserve those protections and must not weaken framing policy for normal API responses.

## Decision

- Detect only requests under the configured Studio preview path in the security-header middleware.
- Keep the reverse proxy's global security headers aligned with the same preview-path exception and hide duplicate backend framing headers at the API proxy boundary.
- Keep `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` for every non-preview response.
- Omit `X-Frame-Options` for signed preview documents and set CSP `frame-ancestors` to `'self'`, the configured frontend URL/CORS origins, and supported local development origins.
- Keep preview URLs signed, read-only, expiring, and workspace-scoped; this decision changes embedding policy only.
- Keep the frontend iframe sandbox enabled and show an in-app retry/error state when the preview cannot load.

## Consequences

- **Positive:** Studio previews render across the separate frontend/API origins used by local development and production, while normal API responses retain strict framing protections.
- **Negative / Cost:** The configured frontend origin list becomes part of the preview response policy and must remain accurate when deployments move.
- **Follow-up:** Add regression coverage for preview and non-preview security headers and verify deployment CORS/frontend settings together.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Serve previews through the frontend origin | Requires a new proxy/deployment path and duplicates existing signed preview routing. |
| Remove frame protections globally | Unnecessarily weakens every API response. |
| Use `X-Frame-Options: ALLOW-FROM` | Poor browser support and cannot express the current multi-origin policy reliably. |

## References

- server/app/main.py
- nginx/nginx.conf
- nginx/conf.d/default.conf
- nginx/conf.d/default.backend.conf
- server/app/services/studio/preview.py
- `website/src/pages/studio/PreviewPane.jsx`
