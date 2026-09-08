import json
import logging
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any

from openai import OpenAI, OpenAIError

from app.services.ai_models.contracts import (
    AIServiceError,
    ProviderClient,
    ProviderResponse,
    StreamChunk,
    ToolCall,
    classify_provider_error,
)

logger = logging.getLogger(__name__)

# Conservative max output tokens to avoid OpenRouter 402 credit checks
# (free tier can only afford ~3810 total tokens; request + prompt must fit).
# OpenRouter is most constrained, so use 1024 there, 4096 elsewhere.
DEFAULT_MAX_TOKENS = 4096
OPENROUTER_MAX_TOKENS = 1024

_PROVIDER_MAX_TOKENS: dict[str, int] = {
    "openrouter": OPENROUTER_MAX_TOKENS,
    "groq": 4096,
    "ollama": 8192,
    "opencode": 4096,
    "openai": 4096,
}


def _provider_label(client: Any) -> str:
    try:
        raw = getattr(client, "_base_url", None) or getattr(client, "base_url", None) or ""
        label = str(raw)
    except Exception:
        label = ""
    low = label.lower()
    if "openrouter" in low:
        return "openrouter"
    if "groq" in low:
        return "groq"
    if "opencode" in low:
        return "opencode"
    if "ollama" in low or "11434" in low:
        return "ollama"
    if "openai" in low:
        return "openai"
    return "provider"


def _max_tokens_for(client: Any) -> int:
    try:
        return _PROVIDER_MAX_TOKENS.get(_provider_label(client), DEFAULT_MAX_TOKENS)
    except Exception:
        return DEFAULT_MAX_TOKENS


def _parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw) if raw else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _convert_tool(tool: dict[str, Any]) -> dict[str, Any]:
    """Convert Eve's flat Responses tool shape to Chat Completions nested shape.

    Eve tools are authored in the flat Responses form
    ``{type, name, description, parameters, strict}`` so the OpenAI Responses
    adapter can pass them through. The Chat Completions surface (used by
    OpenRouter/Ollama/Groq/OpenCode) requires the nested
    ``{type, function: {name, description, parameters, strict}}`` shape.
    Pass-through already-nested tools and empty placeholders unchanged so
    unit tests that use ``[{}]`` as a dummy still pass.
    """
    if not isinstance(tool, dict) or not tool:
        return tool
    if "function" in tool and isinstance(tool["function"], dict):
        return tool
    if "name" not in tool:
        return tool
    function: dict[str, Any] = {
        "name": tool["name"],
        "description": tool.get("description", ""),
        "parameters": tool.get("parameters", {"type": "object", "properties": {}}),
    }
    if "strict" in tool:
        function["strict"] = tool["strict"]
    return {"type": "function", "function": function}


class OpenAiCompatibleClient(ProviderClient):
    """Provider adapter for OpenAI-compatible /chat/completions APIs.

    Used by OpenRouter, Ollama, and OpenCode — they expose the classic
    Chat Completions surface (not the newer Responses API), including
    tool calling via `tools` / `tool_calls`.
    """

    def build_client(self, client_options: dict[str, Any]) -> OpenAI:
        # Inject OpenRouter Referer/Title if not already present (client_options may carry default_headers)
        try:
            options = dict(client_options)
            # Ensure OpenRouter default_headers are propagated even when built via get_provider_client
            # (config._client_options already sets them, but direct AiConfig may bypass)
            if options.get("base_url") and "openrouter.ai" in options["base_url"]:
                hdrs = options.get("default_headers") or {}
                if "HTTP-Referer" not in hdrs and "Referer" not in hdrs:
                    from app.core.config import settings as _settings

                    hdrs["HTTP-Referer"] = _settings.frontend_url
                if "X-Title" not in hdrs:
                    hdrs["X-Title"] = "Starwaves"
                options["default_headers"] = hdrs
            return OpenAI(**options)
        except Exception as error:
            logger.error(f"[OpenAI-Compatible Provider] Failed to initialize client: {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Provider client initialization failed: {type(error).__name__}: {error}") from error

    def normalize_messages(self, messages: list[dict[str, str]]) -> list[dict[str, str]]:
        return [
            {"role": message["role"], "content": message["content"]}
            for message in messages
        ]

    def call(
        self,
        model: str,
        instructions: str,
        conversation: Any,
        tools: list[dict[str, Any]],
    ) -> ProviderResponse:
        converted = [_convert_tool(tool) for tool in tools] if tools else None
        max_tokens = _max_tokens_for(self.client)
        response = None
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": instructions}, *conversation],
                tools=converted,
                max_tokens=max_tokens,
            )
        except OpenAIError as error:
            logger.error(f"[OpenAI-Compatible Provider] API call failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            prov = _provider_label(self.client)
            classified = classify_provider_error(error, prov, model)
            # Quota 402 often due to max_tokens too high on free tier — retry once with halved tokens
            if classified.kind == "quota" and max_tokens > 512:
                try:
                    retry_tokens = max(512, max_tokens // 2)
                    logger.warning(f"[OpenAI-Compatible Provider] Retrying {model} with max_tokens={retry_tokens} after quota error")
                    response = self.client.chat.completions.create(
                        model=model,
                        messages=[{"role": "system", "content": instructions}, *conversation],
                        tools=converted,
                        max_tokens=retry_tokens,
                    )
                except Exception as retry_error:
                    logger.error(f"[OpenAI-Compatible Provider] Retry failed for model '{model}': {type(retry_error).__name__}: {retry_error}", exc_info=True)
                    raise classified from error
            else:
                raise classified from error
        except Exception as error:
            logger.error(f"[OpenAI-Compatible Provider] Unexpected failure calling model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise classify_provider_error(error, "provider", model) from error

        choice = response.choices[0] if response.choices else None
        message = choice.message if choice else None
        tool_calls = [
            ToolCall(
                call_id=getattr(tc, "id", None) or getattr(getattr(tc, "function", None), "name", None) or "tool",
                name=getattr(getattr(tc, "function", None), "name", None) or getattr(tc, "name", ""),
                arguments=_parse_arguments(getattr(getattr(tc, "function", None), "arguments", None)),
            )
            for tc in (message.tool_calls or [])
        ] if message else []
        text = message.content if message else None
        return ProviderResponse(text=text, tool_calls=tool_calls, raw=response)

    def call_stream(
        self,
        model: str,
        instructions: str,
        conversation: Any,
        tools: list[dict[str, Any]],
    ) -> Iterator[StreamChunk]:
        converted = [_convert_tool(tool) for tool in tools] if tools else None
        max_tokens = _max_tokens_for(self.client)
        stream = None
        try:
            stream = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": instructions}, *conversation],
                tools=converted,
                max_tokens=max_tokens,
                stream=True,
            )
        except OpenAIError as error:
            logger.error(f"[OpenAI-Compatible Provider] Streaming call failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            prov = _provider_label(self.client)
            classified = classify_provider_error(error, prov, model)
            if classified.kind == "quota" and max_tokens > 512:
                try:
                    retry_tokens = max(512, max_tokens // 2)
                    logger.warning(f"[OpenAI-Compatible Provider] Retrying stream {model} with max_tokens={retry_tokens} after quota error")
                    stream = self.client.chat.completions.create(
                        model=model,
                        messages=[{"role": "system", "content": instructions}, *conversation],
                        tools=converted,
                        max_tokens=retry_tokens,
                        stream=True,
                    )
                except Exception as retry_error:
                    logger.error(f"[OpenAI-Compatible Provider] Stream retry failed for model '{model}': {type(retry_error).__name__}: {retry_error}", exc_info=True)
                    raise classified from error
            else:
                raise classified from error
        except Exception as error:
            logger.error(f"[OpenAI-Compatible Provider] Unexpected streaming failure for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise classify_provider_error(error, "provider", model) from error

        content_slots: list[dict[str, Any]] = []
        text_parts: list[str] = []
        in_think_block = False
        try:
            for chunk in stream:
                choice = chunk.choices[0] if chunk.choices else None
                delta = choice.delta if choice else None
                if delta is None:
                    continue

                # 1. Check for explicit reasoning / thinking field (Ollama / OpenRouter / DeepSeek)
                reasoning = (
                    getattr(delta, "reasoning_content", None)
                    or getattr(delta, "reasoning", None)
                    or getattr(delta, "thought", None)
                )
                if reasoning:
                    yield StreamChunk(kind="thinking_delta", text=reasoning)

                # 2. Check for content and handle inline <think> tags if present
                raw_content = getattr(delta, "content", None)
                if raw_content:
                    rem = raw_content
                    while rem:
                        if not in_think_block:
                            if "<think>" in rem:
                                before, after = rem.split("<think>", 1)
                                if before:
                                    text_parts.append(before)
                                    yield StreamChunk(kind="text_delta", text=before)
                                in_think_block = True
                                rem = after
                            else:
                                text_parts.append(rem)
                                yield StreamChunk(kind="text_delta", text=rem)
                                rem = ""
                        else:
                            if "</think>" in rem:
                                think_text, after = rem.split("</think>", 1)
                                if think_text:
                                    yield StreamChunk(kind="thinking_delta", text=think_text)
                                in_think_block = False
                                rem = after
                            else:
                                yield StreamChunk(kind="thinking_delta", text=rem)
                                rem = ""

                for tc in (getattr(delta, "tool_calls", None) or []):
                    # Accumulate streamed tool-call argument fragments by index.
                    while len(content_slots) <= tc.index:
                        content_slots.append({"id": "", "name": "", "arguments": ""})
                    slot = content_slots[tc.index]
                    if getattr(tc, "id", None):
                        slot["id"] = tc.id
                    if getattr(tc, "function", None) and tc.function.name:
                        slot["name"] = tc.function.name
                    if getattr(tc, "function", None) and tc.function.arguments:
                        slot["arguments"] += tc.function.arguments
        except AIServiceError:
            raise
        except Exception as error:
            logger.error(f"[OpenAI-Compatible Provider] Streaming iteration failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise classify_provider_error(error, _provider_label(self.client), model) from error

        # Synthesize a raw response shaped like the non-streaming one so
        # continuation() can read choices[0].message unchanged.
        synthetic_tool_calls = [
            SimpleNamespace(
                id=slot["id"] or slot["name"],
                function=SimpleNamespace(name=slot["name"], arguments=slot["arguments"]),
            )
            for slot in content_slots
            if slot["name"]
        ]
        message = SimpleNamespace(
            content="".join(text_parts) or None,
            tool_calls=synthetic_tool_calls or None,
        )
        raw = SimpleNamespace(choices=[SimpleNamespace(message=message)])
        yield StreamChunk(
            kind="final",
            response=ProviderResponse(
                text="".join(text_parts) or None,
                tool_calls=[
                    ToolCall(
                        call_id=slot["id"] or slot["name"],
                        name=slot["name"],
                        arguments=_parse_arguments(slot["arguments"]),
                    )
                    for slot in content_slots
                    if slot["name"]
                ],
                raw=raw,
            ),
        )

    def continuation(self, response: ProviderResponse) -> list[Any]:
        raw = response.raw
        choice = raw.choices[0] if raw.choices else None
        if not choice:
            return []
        # Reconstruct the assistant turn including any tool calls
        entry: dict[str, Any] = {"role": "assistant", "content": choice.message.content or ""}
        if choice.message.tool_calls:
            entry["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in choice.message.tool_calls
            ]
        return [entry]

    def tool_result_blocks(self, call: ToolCall, output: str) -> list[Any]:
        return [
            {
                "role": "tool",
                "tool_call_id": call.call_id,
                "content": output,
            }
        ]
