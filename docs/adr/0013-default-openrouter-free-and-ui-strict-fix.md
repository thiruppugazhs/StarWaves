# ADR 0013 — Default to OpenRouter Free Router and Fix UI Tool Strict Schema

## Status

Accepted

- Date: 2026-09-01
- Deciders: @susin-d
- Tags: `ai`, `openrouter`, `defaults`, `tool-schema`, `strict`

## Context

EVE's default provider was `openai/gpt-5-mini` (universal `openai` default via ADR 0005). Users without an OpenAI key saw immediate failures. The reported error was:

`Invalid schema for function 'get_ui_state': 'required' is required to be supplied ... Missing 'page'. tools[61].parameters`

This is OpenAI Responses strict-mode validation: when `strict:true`, `required` must be present and must include every key in `properties`. `get_ui_state` (and other UI tools with optional `page`/`version`/`code`) omitted `required` or listed only a subset, so `openai/gpt-5-mini` rejected the entire tool list with `400 invalid_function_parameters`. The same pattern existed for `update_ui_styles`, `manage_ui_visibility`, `reset_ui`, `list_ui_history`, `create_custom_page` (all `strict:true` with optional fields).

Separately, users requested the default be the OpenRouter Free Router (`openrouter/free`) — a meta-router that filters to models supporting the request's features (tool calling, vision, structured output) and picks a free model at random. Docs show 24 free variants, OpenAI-compatible `POST /v1/chat/completions` with `openrouter/free`, priced as the routed model. Using `openrouter` as default gives free inference without requiring an OpenAI key and aligns with Vercel serverless where Ollama is unavailable.

## Decision

- **UI tool schema fix** (`server/app/services/eve/tools/ui.py:10`): Set `strict:false` for all UI tools with optional fields and add explicit `required: []` where previously missing. `get_ui_state`: `required: []`, `strict:false`. `update_ui_styles`, `manage_ui_visibility`: keep required for truly required fields, `strict:false`. `reset_ui`: `required: []`, `strict:false`. `list_ui_history`: `required: []`, `strict:false`. `create_custom_page`: keep required for `slug/title/description`, `strict:false` so optional `code` remains optional. This satisfies both OpenAI Responses and Chat Completions validators.

- **Default to OpenRouter Free** (`server/app/core/config.py:85,105`, `server/app/services/ai_models/catalog.py:11`, `server/app/services/ai_models/config.py:87`, `server/app/schemas/ai_models.py:36`, `website/src/pages/EvePage.jsx:86,109`, `website/src/pages/studio/BuilderChat.jsx:46`, `website/src/pages/studio/StudioProjectsPage.jsx:11`):
  - `DEFAULT_AI_PROVIDER` env default `openai` → `openrouter`
  - `OPENROUTER_MODEL` env default `openai/gpt-4o-mini` → `openrouter/free`
  - `DEFAULT_PROVIDER` import now resolves to `openrouter`
  - `_PREFERRED_PROVIDER_ORDER` reordered to `openrouter → openai → anthropic → gemini → groq → ollama → opencode`
  - `AiModelsResponse.default_provider/default_model` `openai/gpt-5-mini` → `openrouter/openrouter/free`
  - Frontend fallbacks `gpt-5-mini` → `openrouter/free` (EvePage, BuilderChat)

- **Scope:** `server/app/services/eve/tools/ui.py`, `server/app/core/config.py`, `server/app/services/ai_models/catalog.py`, `server/app/services/ai_models/config.py`, `server/app/schemas/ai_models.py`, `website/src/pages/EvePage.jsx`, `website/src/pages/studio/*`

## Consequences

- **Positive:** New users get working free inference out-of-the-box without configuring any provider key (if `OPENROUTER_API_KEY` is set server-side). OpenAI strict validation no longer blocks tool calling for UI tools. Fallback order ensures `openrouter` is tried first; existing env overrides still work.
- **Negative / Cost:** Users relying on `openai` default must set `DEFAULT_AI_PROVIDER=openai` or set a user preference. `openrouter/free` quality/latency varies (random free model, may be rate-limited). Changing `_PREFERRED_PROVIDER_ORDER` is a behavior break for Ollama-default devs — mitigated by env override.
- **Follow-up:** Update `.env.example` and Vercel env to set `OPENROUTER_API_KEY` and document `openrouter/free`. Validate that `openai_compat` conversion still preserves `strict` flag for OpenRouter.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Keep `openai/gpt-5-mini` default and only fix `get_ui_state` `required: ["page"]` with `strict:true` | Makes `page` required (breaks optional semantics, forces model to always supply page). Doesn’t solve free-tier onboarding. |
| Set `required` to include every optional key and keep `strict:true` | Forces model to supply optional fields even when not needed, increases token overhead and may still fail if model omits them. |
| Keep default `openai` and add `ollama` fallback | Ollama not available serverless (Vercel), so default still fails for most users. |
| Do nothing | Leaves `400 invalid_function_parameters` for any `openai` user and no free default. |

## References

- `server/app/services/eve/tools/ui.py:10`
- `server/app/core/config.py:85`
- `server/app/services/ai_models/config.py:87`
- `server/app/schemas/ai_models.py:36`
- `server/app/services/ai_models/openai_compat.py:30`
- OpenRouter Free Models Router docs (`openrouter/free`)
- OpenAI strict `required` error: `tools[61].parameters` missing `page`
