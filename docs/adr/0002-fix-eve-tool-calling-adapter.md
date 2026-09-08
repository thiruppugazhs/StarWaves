# ADR 0002 — Fix Eve tool calling for OpenAI-compatible providers and add Groq

## Status

Accepted

- Date: 2026-08-30
- Deciders: Starwaves maintainers
- Tags: `eve`, `ai-models`, `tool-calling`, `provider-adapter`

## Context

Eve's tool calling is driven by `app/services/eve/tools/__init__.py:20` `EVE_TOOLS` (~52 tools across 16 domains) and executed via `app/services/ai_models/loop.py:47,83` `run_tool_loop` / `run_tool_loop_stream` with per-provider adapters in `app/services/ai_models/{openai,anthropic,gemini,openai_compat}.py`.

Tools are authored in the **OpenAI Responses flat shape** (`{type:"function", name, description, parameters, strict}`) so `openai.py:67` can pass them through to `client.responses.create`. The Anthropic and Gemini adapters correctly convert this shape (`_convert_tool` in each file) to their native `input_schema` / `FunctionDeclaration` forms.

`openai_compat.py` — used by OpenRouter, Ollama, OpenCode, and (catalog-declared) Groq — **passed the flat shape directly** to `client.chat.completions.create` (`openai_compat.py:58,91`). The Chat Completions surface requires the nested shape `{type:"function", function:{name, description, parameters, strict}}`. The mismatch caused every tool-calling request on those four providers to silently produce zero `tool_calls` (or 400 validation errors on strict providers), breaking Eve for all self-hosted / OpenRouter users. Additionally `catalog.py:42` declared `groq` but `ai_models/__init__.py:24` `PROVIDER_CLIENTS` omitted it, causing `KeyError` on `resolve_ai_config` → `chat_context` for any Groq preference.

## Decision

1. **Add `_convert_tool` to `openai_compat.py`** (`server/app/services/ai_models/openai_compat.py:29-43`): flat → nested conversion preserving `name`, `description`, `parameters`, and `strict` as `function.strict`. Use it in both `call()` and `call_stream()`:
   ```python
   converted = [_convert_tool(t) for t in tools] if tools else None
   ```
   All Eve tools now arrive at Chat Completions as `{type, function:{...}}`.

2. **Register `groq`** in `server/app/services/ai_models/__init__.py:30`: `PROVIDER_CLIENTS["groq"] = OpenAiCompatibleClient`, matching the existing catalog/config plumbing (`config.py:24,69` already handle Groq keys/URLs).

3. Keep `dispatcher.py:147-153` convenience aliases (`list_todos`, `web_search`, etc.) as-is — they are harmless fallbacks when a model hallucinates a convenience name; not exposed in `EVE_TOOLS` so they do not inflate the 52-tool prompt.

Files affected: `server/app/services/ai_models/openai_compat.py`, `server/app/services/ai_models/__init__.py`, `docs/adr/0002-*`, `context.md`.

## Consequences

- **Positive:** Tool calling now works on OpenRouter, Ollama, OpenCode, and Groq (4 of 7 providers). No change for OpenAI/Anthropic/Gemini. Single 30-line helper, no schema churn.
- **Negative / Cost:** Eve still sends ~52 tool definitions per turn (near Anthropic's 64-tool limit); future per-turn filtering remains follow-up. Legacy aliases stay in the `Unsupported` error message.
- **Follow-up:** Consider per-provider tool-subsetting for large prompts; add adapter-level integration test covering `_convert_tool` shape + a streaming Groq round-trip.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Rewrite `EVE_TOOLS` to nested shape and convert back for Responses/Anthropic/Gemini | More churn; three adapters would need inverse conversion; flat shape is natural for Responses. |
| Duplicate tool list per provider | Duplication risk and drift; single conversion layer is cheaper. |
| Remove Groq from catalog instead of adding client | Removes a user-requested provider; adding one registry line fixes the crash. |

## References

- `server/app/services/ai_models/openai_compat.py:29-102`
- `server/app/services/ai_models/__init__.py:24-31`
- `server/app/services/ai_models/catalog.py:8,27-50`
- `server/app/services/eve/tools/__init__.py:20-37`
- `server/app/services/ai_models/loop.py:47-137`
- `server/app/services/eve/dispatcher.py:104-206`
