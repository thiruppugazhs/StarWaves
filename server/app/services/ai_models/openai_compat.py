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
)

logger = logging.getLogger(__name__)


def _parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw) if raw else {}
    except (json.JSONDecodeError, TypeError):
        return {}


class OpenAiCompatibleClient(ProviderClient):
    """Provider adapter for OpenAI-compatible /chat/completions APIs.

    Used by OpenRouter, Ollama, and OpenCode — they expose the classic
    Chat Completions surface (not the newer Responses API), including
    tool calling via `tools` / `tool_calls`.
    """

    def build_client(self, client_options: dict[str, Any]) -> OpenAI:
        try:
            return OpenAI(**client_options)
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
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": instructions}, *conversation],
                tools=tools or None,
            )
        except OpenAIError as error:
            logger.error(f"[OpenAI-Compatible Provider] API call failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Provider API error ({type(error).__name__}): {error}") from error
        except Exception as error:
            logger.error(f"[OpenAI-Compatible Provider] Unexpected failure calling model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Provider client error ({type(error).__name__}): {error}") from error

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
        try:
            stream = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": instructions}, *conversation],
                tools=tools or None,
                stream=True,
            )
        except OpenAIError as error:
            logger.error(f"[OpenAI-Compatible Provider] Streaming call failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Provider API error ({type(error).__name__}): {error}") from error
        except Exception as error:
            logger.error(f"[OpenAI-Compatible Provider] Unexpected streaming failure for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Provider client error ({type(error).__name__}): {error}") from error

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
            raise AIServiceError(f"Provider client error ({type(error).__name__}): {error}") from error

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
