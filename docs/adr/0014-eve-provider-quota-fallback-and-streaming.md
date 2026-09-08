# ADR 0014 — Eve provider quota fallback and streaming text animation

## Status

Accepted

- Date: 2026-09-01
- Deciders: @susin-d
- Tags: `eve`, `ai-models`, `openrouter`, `streaming`, `fallback`

## Context

Eve streaming (`POST /eve/chat/stream` via `stream_chat_with_eve` + `run_tool_loop_stream`) showed two live failures:

1. **OpenRouter 402 quota** — `openai/gpt-4o` via OpenRouter requested `max_tokens=16384` (provider default) and failed with `402 payment required: can only afford 3810 tokens`. Logs: `server/app/services/ai_models/openai_compat.py:137` `APIStatusError 402` → `contracts.classify_provider_error` → `quota` (429). The provider default exceeds free-tier credit limits when combined with Eve's system instructions + RAG + history (~2–3k prompt tokens).

2. **OpenCode 500** — `muse-spark-1.2-contributor-free` via `https://opencode.ai/zen/v1` returned `500 internal server error` for both streaming and blocking (`server/app/services/ai_models/openai_compat.py:100` / `137`). No fallback was attempted, so the user saw `503 Provider is temporarily unavailable`.

Separately, the UI hid the SSE `thinking` deltas. Network showed `{"type":"thinking","text":" ..."}` streaming, but `website/src/pages/eve/EveChatSection.jsx:62` only rendered `streamText` and `activeTool` — `thinkingText`/`toolCalls` props were dropped, so the streaming data was invisible despite the animation request.

## Decision

**A. Cap `max_tokens` for OpenAI-compatible providers and retry on quota:**

- Add `DEFAULT_MAX_TOKENS=4096` and `OPENROUTER_MAX_TOKENS=1024` with per-provider map `server/app/services/ai_models/openai_compat.py:20` and helpers `_provider_label` / `_max_tokens_for` that detect `openrouter|groq|opencode|ollama|openai` from `client._base_url`.
- Pass `max_tokens` explicitly in `call` (`server/app/services/ai_models/openai_compat.py:139`) and `call_stream` (`server/app/services/ai_models/openai_compat.py:191`). On `classify_provider_error` → `quota`, retry once with `max(512, max_tokens//2)` before surfacing.
- Fixes 402 by ensuring first request is 1024 for OpenRouter (prompt+1024 < 3810) and by halving on first quota failure.

**B. Provider fallback for transient `server`/`quota` errors:**

- Add `_FALLBACK_ORDER = ["openrouter","openai","anthropic","gemini","groq","ollama","opencode"]` in `server/app/services/eve/chat.py:16` and `server/app/services/eve/chat_stream.py:19`.
- In `chat_with_eve` (`server/app/services/eve/chat.py:75`) and `stream_chat_with_eve` (`server/app/services/eve/chat_stream.py:96`) catch `AIServiceError` with `kind in ("server","quota")` and:
  1. For `quota`, first try same provider with `build_ai_config(provider, None)` (default model, e.g. `openrouter` → `openrouter/free`).
  2. For `openrouter` quota, explicitly try `openrouter/free`.
  3. Then iterate `_FALLBACK_ORDER` skipping the failed provider, trying each `has_server_key` provider via `build_ai_config` + `PROVIDER_CLIENTS`.
  4. For streaming, `yield` fallback deltas in-place and promote `fallback_done` to `done_event`; for blocking, return fallback `message`.
- Preserves original error if no fallback succeeds; otherwise session persistence and `log_usage` use the successful provider.

**C. Streaming text animation:**

- `website/src/pages/eve/EveChatSection.jsx:29` adds `EveThoughtHistory` (collapsible) and expands `EveChatSection` to accept `thinkingText`/`toolCalls` (`website/src/pages/eve/EveChatSection.jsx:52`). Live block `website/src/pages/eve/EveChatSection.jsx:261` shows `thinking` with pulsing `Eye`, `eve-thought-stream` + `eve-thinking-cursor`, live `toolCalls` chips, and `streamText` via `Markdown` + `eve-streaming-cursor` (`website/src/styles/pages/eve.css:440` `eve-caret-blink 0.95s`, `eve-stream-fade-in`). Historical messages also render `msg.thinking`/`msg.toolCalls`.
- `website/src/pages/workspace/useEveAgentChat.js:17` tracks `thinkingText`; `website/src/pages/workspace/WorkspaceEvePanel.jsx:17` renders `workspace-eve-thinking` + cursor and `streamText` + cursor; `website/src/styles/pages/workspace.css:1240` adds styles and hides duplicate `::after` when custom cursor present.

## Consequences

- **Positive:** Free-tier OpenRouter no longer 402 on first turn; quota on paid models auto-retries with half tokens then falls back to `openrouter/free` or next provider. `opencode` 500 now falls back to `groq`/`openai` etc. UI finally surfaces `thinking` deltas with blinking cursor and tool chips, matching Network SSE.
- **Negative / Cost:** Extra `max_tokens` param may slightly cap long answers (4096 chars ~3k tokens) — acceptable for free tier; reasoning models that prefer `max_completion_tokens` still use `max_tokens` (SDK compat, not strict). Fallback adds one extra provider round-trip on failure (latency).
- **Follow-up:** Make `OPENROUTER_MAX_TOKENS` env-configurable; add `max_completion_tokens` for `o1`/`gpt-5` reasoners; emit fallback notice in SSE `done` for UI banner.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Do nothing, require user to buy credits | Poor UX; free tier should work with lower `max_tokens` and fallback. |
| Only lower `max_tokens` without fallback | Fixes 402 but not 500 `opencode` outage. |
| Always fallback on any `AIServiceError` | Would hide `auth`/`model_not_found` (401/404) that need user action in Settings. |
| Frontend-only retry with lower `max_tokens` | Backend is source of truth for credit check; retry belongs in adapter. |

## References

- `server/app/services/ai_models/openai_compat.py:20` `DEFAULT_MAX_TOKENS`/`_provider_label`
- `server/app/services/ai_models/openai_compat.py:132` `call` with quota retry
- `server/app/services/ai_models/openai_compat.py:189` `call_stream` with quota retry
- `server/app/services/eve/chat.py:75` fallback for `server`/`quota`
- `server/app/services/eve/chat_stream.py:96` streaming fallback yielding `fallback_done`
- `server/app/services/ai_models/contracts.py:59` `classify_provider_error` quota/server mapping
- `website/src/pages/eve/EveChatSection.jsx:29` `EveThoughtHistory`
- `website/src/styles/pages/eve.css:440` `eve-streaming-cursor`/`eve-thinking-cursor`
