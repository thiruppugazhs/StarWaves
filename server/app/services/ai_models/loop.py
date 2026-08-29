"""AI tool loop — single responsibility: drive provider tool-calling rounds until
the model produces a final answer, for both blocking and streaming calls."""

import json
import logging
from collections.abc import Callable, Iterator
from typing import Any

from pydantic import ValidationError

from app.services.ai_models.catalog import MAX_TOOL_ROUNDS
from app.services.ai_models.contracts import AIServiceError, AiConfig, ProviderClient, ProviderResponse

logger = logging.getLogger(__name__)

_NO_RESPONSE_FALLBACK = "I could not generate a response. Please try again."


def _run_tool_call(
    run_tool: Callable[[str, dict[str, Any]], tuple[Any, str | None, dict[str, Any] | None]],
    call,
    changed_resources: list[str],
    actions: list[dict[str, Any]],
) -> str:
    """Execute one tool call, record its side-effect metadata, and serialize the
    result for the provider conversation."""
    try:
        result, changed_resource, action = run_tool(call.name, call.arguments)
        if changed_resource and changed_resource not in changed_resources:
            changed_resources.append(changed_resource)
        if action:
            actions.append(action)
    except (KeyError, TypeError, ValueError, ValidationError) as error:
        logger.warning(f"[AI Tool Loop] Tool '{call.name}' returned error: {error}")
        result = {"error": str(error)}
    except Exception as error:
        logger.error(f"[AI Tool Loop] Unexpected failure in tool '{call.name}': {type(error).__name__}: {error}", exc_info=True)
        result = {"error": f"Tool execution failed: {type(error).__name__}: {error}"}
    return json.dumps(result, default=str)


def _raise_exceeded_rounds(config: AiConfig) -> None:
    logger.error(f"[AI Tool Loop] Exceeded maximum tool rounds ({MAX_TOOL_ROUNDS}) for {config.provider}/{config.model}")
    raise AIServiceError(f"The AI request exceeded the maximum number of tool rounds ({MAX_TOOL_ROUNDS}).")


def run_tool_loop(
    client: ProviderClient,
    config: AiConfig,
    instructions: str,
    conversation: list[dict[str, str]],
    tools: list[dict[str, Any]],
    run_tool: Callable[[str, dict[str, Any]], tuple[Any, str | None, dict[str, Any] | None]],
    usage_user_id: str | None = None,
    usage_kind: str = "chat",
) -> tuple[str, list[str], list[dict[str, Any]]]:
    """Run the provider tool-calling loop until the model stops calling tools."""
    conversation = client.normalize_messages(conversation)
    changed_resources: list[str] = []
    actions: list[dict[str, Any]] = []
    for _round_idx in range(MAX_TOOL_ROUNDS):
        response = client.call(config.model, instructions, conversation, tools)
        if usage_user_id:
            try:
                from app.services.usage import log_usage

                log_usage(usage_user_id, config.provider, config.model, usage_kind, response.raw, response.text)
            except Exception:
                pass
        if not response.tool_calls:
            return (
                response.text or _NO_RESPONSE_FALLBACK,
                changed_resources,
                actions,
            )
        conversation.extend(client.continuation(response))
        for call in response.tool_calls:
            output = _run_tool_call(run_tool, call, changed_resources, actions)
            conversation.extend(client.tool_result_blocks(call, output))
    _raise_exceeded_rounds(config)


def run_tool_loop_stream(
    client: ProviderClient,
    config: AiConfig,
    instructions: str,
    conversation: list[dict[str, str]],
    tools: list[dict[str, Any]],
    run_tool: Callable[[str, dict[str, Any]], tuple[Any, str | None, dict[str, Any] | None]],
    usage_user_id: str | None = None,
    usage_kind: str = "chat",
) -> Iterator[dict[str, Any]]:
    """Run the provider tool-calling loop with streamed text deltas.

    Yields event dicts:
    - {"type": "delta", "text": str}            — incremental assistant text
    - {"type": "tool_start", "name": str}       — a workspace tool begins executing
    - {"type": "tool_end", "name": str}         — the tool finished
    - {"type": "done", "message": str, "changed_resources": [...], "actions": [...]}
    """
    conversation = client.normalize_messages(conversation)
    changed_resources: list[str] = []
    actions: list[dict[str, Any]] = []
    for _round_idx in range(MAX_TOOL_ROUNDS):
        final_response: ProviderResponse | None = None
        for chunk in client.call_stream(config.model, instructions, conversation, tools):
            if chunk.kind == "text_delta":
                yield {"type": "delta", "text": chunk.text}
            elif chunk.kind == "thinking_delta":
                yield {"type": "thinking", "text": chunk.text}
            elif chunk.kind == "final" and chunk.response is not None:
                final_response = chunk.response
        if final_response is None:
            raise AIServiceError("Provider stream ended without a final response.")
        response = final_response
        if usage_user_id:
            try:
                from app.services.usage import log_usage

                log_usage(usage_user_id, config.provider, config.model, usage_kind, response.raw, response.text)
            except Exception:
                pass
        if not response.tool_calls:
            yield {
                "type": "done",
                "message": response.text or _NO_RESPONSE_FALLBACK,
                "changed_resources": changed_resources,
                "actions": actions,
            }
            return
        conversation.extend(client.continuation(response))
        for call in response.tool_calls:
            yield {"type": "tool_start", "name": call.name, "arguments": call.arguments, "call_id": call.call_id}
            output = _run_tool_call(run_tool, call, changed_resources, actions)
            yield {"type": "tool_end", "name": call.name, "output": output, "call_id": call.call_id}
            conversation.extend(client.tool_result_blocks(call, output))
    _raise_exceeded_rounds(config)
