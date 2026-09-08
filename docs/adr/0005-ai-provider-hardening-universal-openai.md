# ADR 0005 — AI provider hardening: universal OpenAI default + adapter fixes

## Status

Accepted

- Date: 2026-08-31
- Deciders: @susin-d
- Tags: `ai`, `providers`, `eve`, `openai`, `anthropic`, `gemini`, `groq`, `openrouter`, `ollama`

## Context

After ADR 0002 (fix OpenAI-compatible tool calling), Eve was still 502-ing for most users. Live audit (2026-08-31) against current provider docs showed the failure was not a single adapter bug but a systemic misconfiguration:

- `server/app/core/config.py` defaulted `DEFAULT_AI_PROVIDER=ollama` (local `http://127.0.0.1:11434/v1`). In production (Vercel serverless / Docker without Ollama) `has_server_key("ollama")` is false, yet `build_ai_config("default")` still returned an Ollama `AiConfig` with placeholder key `ollama` → every user without explicit preference hit `ConnectionRefused` → 502.
- Stale default models: `gpt-5-mini` (now alias to `gpt-5.6-luna` / deprecation 2026-12-11), `llama-3.1-70b-versatile` (Groq decommissioned, now `llama-3.3-70b`), `openai/gpt-4o` (should be `gpt-4o-mini`), plus a too-narrow OpenAI prefix whitelist (`gpt-`, `o1`, `o3`) hiding `gpt-5*`, `o4*`.
- Missing OpenRouter `HTTP-Referer`/`X-Title` headers (ranking/free-tier requirement) and placeholder `Bearer ollama` sent to local Ollama (rejects/ignored).
- Gemini streaming dropped `thought` parts (`thought_signature` stripping bug #2406) — Gemini 2.5+ then fails function calling.
- Anthropic `MAX_TOKENS=4096` truncated Sonnet 4.6/5 (1M context) and no `base_url` / 1M beta handling.
- OpenAI Responses streaming ignored `reasoning` deltas for `o1`/`o3`/`gpt-5` reasoning models.

Current stack: Responses API for OpenAI, Messages API for Anthropic, `google-genai` for Gemini, Chat Completions via `openai` SDK for OpenRouter/Groq/Ollama/OpenCode. All via `ProviderClient` abstraction + `run_tool_loop` (`loop.py`).

## Decision

Harden AI provider layer universally with OpenAI as default, keep cache TTLs at 5 min per request.

- **Default:** `DEFAULT_AI_PROVIDER=openai` universally (not per-env). `config.build_ai_config("default")` resolves to first available provider in priority `openai → anthropic → gemini → groq → openrouter → ollama → opencode` via new `_first_available_provider()` + `_PREFERRED_PROVIDER_ORDER`. Fixes "most providers failing" for default users. `openai_model` default `gpt-4o-mini`, `groq_model` `llama-3.3-70b-versatile`, `openrouter_model` `openai/gpt-4o-mini` (env overrides still work).
- **Catalog/discovery:** Expand `_OPENAI_MODEL_PREFIXES` (`gpt-`, `o1`, `o3`, `o4`, `chatgpt` + `gpt-3/4/5`). Make `_live_cache_get/set` handle placeholder `ollama` key without collision. `discovery._fetch_openai_compatible_models` and `unified._fetch_openrouter_unified`/`_fetch_openai_compat_unified` suppress `Authorization: Bearer ollama` for Ollama local and inject `HTTP-Referer`/`X-Title` for OpenRouter (`settings.frontend_url`, `Starwaves`). Unified Groq/OpenRouter paths updated similarly.
- **Adapters:**
  - `openai.py`: stream also `response.reasoning.delta` / `reasoning_text.delta` → `thinking_delta`.
  - `anthropic.py`: `MAX_TOKENS 4096→8192`, explicit `build_client` base_url forwarding.
  - `gemini.py`: preserve `thought` parts in `call` (skip for text extraction) and emit `thinking_delta` in `call_stream`; keep `thought` parts for `thought_signature` continuation.
  - `openai_compat.py`: inject OpenRouter `default_headers` in `build_client` if `base_url` contains `openrouter.ai`.
  - `config._client_options`: centralize OpenRouter header injection and placeholder handling.
- **Scope:** `server/app/core/config.py`, `server/app/services/ai_models/{catalog,config,discovery,unified,openai,anthropic,gemini,openai_compat}.py`, `server/app/services/eve` voice path inherits Groq fix.

## Consequences

- **Positive:** Default chat works in prod without user action; valid OpenAI key → OpenAI, else next available. Stale model IDs no longer 404. OpenRouter free-tier discovery reliable. Gemini function calling stable on 2.5+. Ollama local no longer pollutes 502. Cache stays 5 min per ask.
- **Negative / Cost:** Changing `DEFAULT_AI_PROVIDER` default is a behavior break for local devs relying on Ollama default — they must set `DEFAULT_AI_PROVIDER=ollama` or user preference. `_first_available_provider()` evaluates at runtime per request, not import time, so import snapshot `catalog.DEFAULT_PROVIDER` remains `openai`.
- **Follow-up:** Verify `opencode` provider docs (kept, but unclear public stability). Consider `openai_model` env rollout `gpt-4o-mini` → `gpt-5-mini` once stable alias confirmed. Add integration probe endpoint for provider health.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep `ollama` default and require user to pick provider | Fails serverless (no Ollama) and broke "most providers" for new users; violates universally-openai requirement. |
| Per-env default (`ollama` dev, `openai` prod) | Adds branching and surprise; user asked for universally `openai`. Env override still available via `DEFAULT_AI_PROVIDER`. |
| Remove placeholder `ollama` key entirely | `openai` SDK requires some `api_key` string even for local Ollama; placeholder needed but must not be sent as Bearer for discovery. |
| Do nothing | Leaves 502 for default users; live model list hides/suppresses new models. |

## References

- `server/app/core/config.py:83`
- `server/app/services/ai_models/config.py:87-123`
- `server/app/services/ai_models/catalog.py:22`
- `server/app/services/ai_models/discovery.py:22-134`
- `server/app/services/ai_models/unified.py:157-238`
- `server/app/services/ai_models/openai.py:105-121`
- `server/app/services/ai_models/anthropic.py:17`
- `server/app/services/ai_models/gemini.py:104-147`
- `server/app/services/ai_models/openai_compat.py:64-69`
- `https://developers.openai.com/api/docs/guides/migrate-to-responses`
- `https://platform.claude.com/docs/en/api/models/list`
- `https://googleapis.github.io/python-genai/`
- `https://github.com/googleapis/python-genai/issues/2406`
