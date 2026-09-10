# ADR 0046 — Transport canonicals: apiRequest, shared WS base, updater roles, AI route ownership

## Status

Accepted

- Date: 2026-09-10
- Deciders: refactor agent (Phase 2 canonicals)
- Tags: `frontend`, `transport`, `ai-models`, `single-source-of-truth`

## Context

`lib/request.js apiRequest` (+ `fetchWithTimeout`) is used by ~30 clients, but raw `fetch` appears in `googleContacts.js`/`googleMail.js` (OAuth popup flow), `modelingApi.js:76` (binary), `updatesApi.js` (public no-auth), and `eveApi.js` SSE/MediaSource streams. `callsSocket.js:19-32` and `whatsappSocket.js:8-19` duplicate `buildWsUrl` (http→ws + strip `/api/v1` + `window.location` fallback) plus identical backoff (`500/30_000/×2`) and subscribe/visibility logic. Updaters overlap: `updatesApi.js` transport + `desktopUpdater/androidUpdater/otaUpdater` silent-check guards. `routes/ai_models.py` (`/settings/ai-models`) vs `routes/unified_models.py` (`/models`) share only the legacy `api_key→api_keys[provider]` migration block (`ai_models.py:39-50` ≡ `unified_models.py:19-35`). See `CODEBASE_AUDIT.md` §3.4–3.8.

## Decision

- Chosen approach:
  - `apiRequest` + `fetchWithTimeout` from `request.js` is the only JSON transport. Raw `fetch` stays **only** for OAuth popup (`googleContacts/googleMail` reusing `API_URL`), binary download (`modelingApi`), and SSE/MediaSource streams (`eveApi/eveSpeechStream`) — each with an inline justification comment per AGENTS §4.5-2. `updatesApi.js` public calls keep `API_URL` and document no-auth.
  - New `lib/wsClient.js` (`getWsBase()` + `createWsClient(path)`) owns base derivation, backoff, and visibility; `callsSocket` + `whatsappSocket` become thin path configs (`/ws/calls`, `/ws/whatsapp`).
  - Updaters: `updatesApi.js` stays transport; extract the shared silent-check guard only if byte-identical, keeping Tauri vs Capacitor branches.
  - AI routes: keep both prefixes with clarified ownership (`/settings/ai-models` = preference CRUD, `/models` = live discovery); extract one `_extract_user_keys` helper (legacy `api_key` migration) shared by both.
- Scope: `website/src/lib/`, `server/app/api/routes/ai_models.py`, `server/app/api/routes/unified_models.py`, `server/app/services/ai_models/config.py`.
- Migration plan: helper first, then socket/base dedup, then updater guard; no URL/path/status change.

## Consequences

- **Positive:** one JSON path, one WS derivation, clear updater roles, one legacy-key implementation; OAuth/binary/streaming exceptions are explicit not accidental.
- **Negative / Cost:** two new small modules (`wsClient`, shared key helper) — justified singletons; socket refactor needs reconnect manual smoke.
- **Follow-up:** Phase 7 reconnect/backoff tests; Phase 9 ownership tests for AI preference vs discovery.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Force everything through `apiRequest` | Breaks binary/SSE/popup flows that need non-JSON handling. |
| Merge `/settings/ai-models` + `/models` routes | Different ownership (settings vs discovery) and prefixes; merge would churn URLs for no behavior gain. |

## References

- `CODEBASE_AUDIT.md` §3.4–3.8
- `website/src/lib/request.js`, `website/src/lib/callsSocket.js:19-32`, `website/src/lib/whatsappSocket.js:8-19`
- `server/app/api/routes/ai_models.py:39-50`, `server/app/api/routes/unified_models.py:19-35`
