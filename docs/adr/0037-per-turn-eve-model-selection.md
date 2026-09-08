# ADR 0037 — Per-turn EVE model selection

## Status

Accepted

- Date: 2026-09-07
- Deciders: StarWaves maintainers
- Tags: `eve`, `ai-models`, `workspace`

## Context

The Workspace EVE Agent composer currently sends every request through the user's resolved default AI configuration. The shared `ModelSelectorDropdown` already exposes real configured providers and models elsewhere in the product, but the workspace composer has no way to choose a model for an individual turn.

Adding only a visual selector would create a misleading control. The selected provider and model must travel through both the SSE path and the REST fallback, while retaining the existing default configuration behavior for all callers that do not provide an override.

## Decision

- Add optional `provider` and `model` fields to `EveChatRequest`.
- Pass the selection through `eveApi` for both `sendEveMessage` and `streamEveMessage`.
- Resolve per-turn overrides through the existing `build_ai_config` and user API-key preference logic without caching override-specific configurations.
- Add the shared `ModelSelectorDropdown` to `WorkspaceEvePanel`, opening upward from the bottom composer and disabling it while a request is active.
- Preserve the existing request contract for all non-selector callers by omitting override fields when no selection is supplied.

## Consequences

- **Positive:** Workspace users can select any configured model for the next EVE turn, including streamed tool-enabled requests and fallback requests.
- **Positive:** Existing EVE surfaces continue using the persisted default model unchanged.
- **Negative / Cost:** The chat request schema and service signatures gain optional override parameters, and the workspace composer uses an additional compact toolbar row.
- **Follow-up:** Model availability and credentials remain governed by the existing AI Models settings and provider configuration.

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Change the persisted global AI preference | Makes a temporary workspace choice affect every EVE surface and future turns. |
| Add a selector with UI-only state | The visible choice would not affect the model actually serving the request. |
| Encode the model in the user message | Pollutes conversation content and cannot reliably select provider credentials. |

## References

- `website/src/pages/workspace/WorkspaceEvePanel.jsx`
- `website/src/pages/workspace/useEveAgentChat.js`
- `website/src/lib/eveApi.js`
- `server/app/schemas/eve.py`
- `server/app/services/ai_models/config.py`
