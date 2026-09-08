# ADR 0007 — Differentiated AI provider error messages (rate limit vs other)

## Status

Accepted

- Date: 2026-08-31
- Deciders: @susin-d
- Tags: `ai`, `errors`, `eve`, `ux`, `rate-limit`, `openai`, `anthropic`, `gemini`

## Context

After ADR 0005 (universal OpenAI default), all provider failures still surfaced as generic `502 Bad Gateway` with `Eve AI service error (provider/model): <raw>` . Users could not distinguish a transient `429 Rate limit` (retry after seconds) from a permanent `401 Invalid API key` (needs Settings change) or `404 Model not found` or `422 Context length` . The previous fix only hardened routing/discovery, not UX. Frontend `EveChatSection` showed the same monochrome banner for every failure, and `EvePage` always fell back to REST without knowing if the failure was retryable. Requirement: "Show Different error message rate limit and other provider error also" with distinct HTTP status + user-facing text and retry hints.

## Decision

Introduce kinded `AIServiceError` and per-provider classification so Eve returns distinct status + message per class.

- **Contracts:** `contracts.py` `AIServiceError(message, kind, status_code, retry_after, provider)` + helpers `_extract_status_code` + `classify_provider_error(error, provider, model) -> AIServiceError`. Classification checks `status_code` (from `error.status_code` / `response.status_code` / `code`) and lowercased message keywords: rate_limit (429, `rate limit`, `too many requests`, `resource_exhausted`), auth (401/403, `invalid_api_key`, `authentication`), quota (402, `insufficient_quota`, `billing`), model_not_found (404, `model_not_found`), context_length (`context_length`, `too many tokens`), server (500/502/503, `overloaded`). Extracts `Retry-After` header. Maps to friendly messages: rate limit → `"{Label} rate limit exceeded. Please wait …"`, quota → `"{Label} quota exceeded. Check billing …"`, auth → `"{Label} authentication failed. Check Settings > AI Models …"`, model_not_found → `"Model '…' not found …"`, context → `"context limit exceeded. Start new chat …"`, server → `"temporarily unavailable …"`. Fallback prefixes provider label.
- **Adapters:** `openai.py`, `anthropic.py`, `gemini.py`, `openai_compat.py` wrap `OpenAIError`/`APIError` etc. via `classify_provider_error` instead of generic `AIServiceError(f"...")`. Preserves `kind`/`status_code`/`retry_after` through `loop.py`.
- **Orchestrators:** `eve/chat.py` now catches `AIServiceError` and returns `HTTPException(status_code=error.status_code, detail=..., headers={"Retry-After": ...})` (429 for rate/quota, 401 auth, 404 model, 422 context, 503 server, else 502). `eve/chat_stream.py` yields `type: error` frames with `code`, `status`, `retry_after` fields so SSE in-band errors are also kinded.
- **Frontend:** `lib/eveApi.js` `streamEveMessage` throws `Error` with `code/status/retryAfter` from SSE frame; initial `fetch` failure maps HTTP 429→`rate_limit`, 401→`auth`, etc. `pages/EvePage.jsx` `sendPrompt` now branches: stream 429 → no REST fallback, shows rate-limit banner; REST fallback maps status/code to friendly messages. `pages/workspace/useEveAgentChat.js` mirrors. `pages/eve/EveChatSection.jsx` renders `eve-error-banner--rate` (clock icon, "please wait…retry") vs `--auth` (check Settings) vs generic, with hint text. `styles/pages/eve.css` adds `--rate`/`--auth` variants (monochrome, left 3px accent).
- **Scope:** `server/app/services/ai_models/*`, `server/app/services/eve/*`, `website/src/lib/eveApi.js`, `website/src/pages/{EvePage.jsx,eve/EveChatSection.jsx,workspace/useEveAgentChat.js}`, `website/src/styles/pages/eve.css`.

## Consequences

- **Positive:** Users see actionable messages: rate limit → "wait and retry", auth → "check API key", model not found → "pick available model", context → "start new chat". HTTP 429 enables `request.js` retry and `Retry-After` header. SSE errors are kinded for live UI. No new deps.
- **Negative / Cost:** Cross-cutting change touches 9 files; snapshot `context.md` grows. Existing test `test_eve_chat_returns_detailed_502` still passes (direct `AIServiceError` bypasses classifier); new tests should assert 429 for rate_limit.
- **Follow-up:** Add pytest for `classify_provider_error` per provider + frontend Vitest for banner variants. Consider toast with countdown for `retry_after`.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep single 502 + generic message | Fails requirement; users cannot distinguish retryable vs config errors. |
| Only change message text, not status code | Frontend needs `status` to decide retry/fallback (currently REST fallback would just 429 again). |
| New exception types per kind (AIRateLimitError, etc.) | More classes for same `kind` string; `AIServiceError(kind=...)` is lighter and JSON-serializable. |
| Do nothing on frontend, only backend | Backend messages already distinct, but without banner variants UX still monochrome-generic. |

## References

- `server/app/services/ai_models/contracts.py:12-110` — classifier
- `server/app/services/ai_models/openai.py:74-79` — classify usage
- `server/app/services/eve/chat.py:38-72` — status-mapped HTTPException
- `server/app/services/eve/chat_stream.py:54-89` — SSE code/status
- `website/src/lib/eveApi.js:102-108` — code propagation
- `website/src/pages/EvePage.jsx:299-336` — rate-limit branch
- `website/src/pages/eve/EveChatSection.jsx:235-251` — banner variants
