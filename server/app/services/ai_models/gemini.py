import json
import logging
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.services.ai_models.contracts import (
    AIServiceError,
    ProviderClient,
    ProviderResponse,
    StreamChunk,
    ToolCall,
)

logger = logging.getLogger(__name__)


def _convert_tool(tool: dict[str, Any]) -> types.Tool:
    """Convert an OpenAI-style tool definition to a Gemini Tool."""
    function = types.FunctionDeclaration(
        name=tool["name"],
        description=tool.get("description", ""),
        parameters=tool.get("parameters"),
    )
    return types.Tool(function_declarations=[function])


def _parts_tool_calls(parts: list[Any]) -> list[ToolCall]:
    """Extract tool calls from a sequence of Gemini content parts."""
    tool_calls: list[ToolCall] = []
    for part in parts:
        function_call = getattr(part, "function_call", None)
        if function_call is not None and getattr(function_call, "name", None):
            tool_calls.append(
                ToolCall(
                    call_id=function_call.id or function_call.name,
                    name=function_call.name,
                    arguments=dict(function_call.args or {}),
                )
            )
    return tool_calls


class GeminiProviderClient(ProviderClient):
    """Google Gemini provider adapter using the google-genai SDK."""

    def build_client(self, client_options: dict[str, Any]) -> genai.Client:
        try:
            options = dict(client_options)
            api_key = options.pop("api_key")
            base_url = options.pop("base_url", None)
            if base_url:
                return genai.Client(
                    api_key=api_key,
                    http_options=types.HttpOptions(base_url=base_url),
                )
            return genai.Client(api_key=api_key)
        except Exception as error:
            logger.error(f"[Gemini Provider] Failed to initialize client: {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Gemini client initialization failed: {type(error).__name__}: {error}") from error

    def normalize_messages(self, messages: list[dict[str, str]]) -> list[types.Content]:
        contents = []
        for message in messages:
            role = "model" if message["role"] == "assistant" else "user"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part(text=message["content"])],
                )
            )
        return contents

    def call(
        self,
        model: str,
        instructions: str,
        conversation: Any,
        tools: list[dict[str, Any]],
    ) -> ProviderResponse:
        config = types.GenerateContentConfig(
            system_instruction=instructions,
            tools=[_convert_tool(tool) for tool in tools],
        )
        try:
            response = self.client.models.generate_content(
                model=model,
                contents=conversation,
                config=config,
            )
        except APIError as error:
            logger.error(f"[Gemini Provider] API call failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Gemini API error ({type(error).__name__}): {error}") from error
        except Exception as error:
            logger.error(f"[Gemini Provider] Unexpected failure calling model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Gemini client error ({type(error).__name__}): {error}") from error

        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        if response.candidates:
            parts = response.candidates[0].content.parts
            for part in parts:
                if getattr(part, "text", None):
                    text_parts.append(part.text)
                elif part.function_call:
                    tool_calls.append(
                        ToolCall(
                            call_id=part.function_call.id or part.function_call.name,
                            name=part.function_call.name,
                            arguments=dict(part.function_call.args or {}),
                        )
                    )
        return ProviderResponse(
            text="".join(text_parts) or None,
            tool_calls=tool_calls,
            raw=response,
        )

    def call_stream(
        self,
        model: str,
        instructions: str,
        conversation: Any,
        tools: list[dict[str, Any]],
    ) -> Iterator[StreamChunk]:
        config = types.GenerateContentConfig(
            system_instruction=instructions,
            tools=[_convert_tool(tool) for tool in tools],
        )
        collected_parts: list[Any] = []
        try:
            chunks = self.client.models.generate_content_stream(
                model=model,
                contents=conversation,
                config=config,
            )
            for chunk in chunks:
                candidates = getattr(chunk, "candidates", None)
                parts = candidates[0].content.parts if candidates and candidates[0].content else []
                for part in parts:
                    collected_parts.append(part)
                    if getattr(part, "text", None):
                        yield StreamChunk(kind="text_delta", text=part.text)
        except APIError as error:
            logger.error(f"[Gemini Provider] Streaming call failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Gemini API error ({type(error).__name__}): {error}") from error
        except Exception as error:
            logger.error(f"[Gemini Provider] Unexpected streaming failure for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"Gemini client error ({type(error).__name__}): {error}") from error

        if not collected_parts:
            raise AIServiceError("Gemini stream returned no content.")
        # Synthesize a raw response shaped like the non-streaming one so
        # continuation() can reuse candidates[0].content unchanged.
        content = types.Content(role="model", parts=list(collected_parts))
        raw = SimpleNamespace(candidates=[SimpleNamespace(content=content)])
        text = "".join(p for p in (getattr(part, "text", None) for part in collected_parts) if p) or None
        yield StreamChunk(
            kind="final",
            response=ProviderResponse(text=text, tool_calls=_parts_tool_calls(collected_parts), raw=raw),
        )

    def continuation(self, response: ProviderResponse) -> list[Any]:
        return [response.raw.candidates[0].content]

    def tool_result_blocks(self, call: ToolCall, output: str) -> list[Any]:
        try:
            payload = json.loads(output)
        except (json.JSONDecodeError, TypeError):
            payload = {"output": output}
        return [
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        function_response=types.FunctionResponse(
                            name=call.name,
                            response=payload,
                        )
                    )
                ],
            )
        ]
