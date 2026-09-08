import json
import logging
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


def _parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw) if raw else {}
    except (json.JSONDecodeError, TypeError):
        return {}


class OpenAiProviderClient(ProviderClient):
    """OpenAI provider adapter using the Responses API."""

    def build_client(self, client_options: dict[str, Any]) -> OpenAI:
        try:
            return OpenAI(**client_options)
        except Exception as error:
            logger.error(f"[OpenAI Provider] Failed to initialize client: {type(error).__name__}: {error}", exc_info=True)
            raise AIServiceError(f"OpenAI client initialization failed: {type(error).__name__}: {error}") from error

    def normalize_messages(self, messages: list[dict[str, str]]) -> list[dict[str, str]]:
        return [
            {"role": message["role"], "content": message["content"]}
            for message in messages
        ]

    def _response_from(self, response: Any) -> ProviderResponse:
        tool_calls = [
            ToolCall(
                call_id=item.call_id,
                name=item.name,
                arguments=_parse_arguments(item.arguments),
            )
            for item in response.output
            if item.type == "function_call"
        ]
        return ProviderResponse(
            text=getattr(response, "output_text", None) or None,
            tool_calls=tool_calls,
            raw=response,
        )

    def call(
        self,
        model: str,
        instructions: str,
        conversation: Any,
        tools: list[dict[str, Any]],
    ) -> ProviderResponse:
        try:
            response = self.client.responses.create(
                model=model,
                instructions=instructions,
                input=conversation,
                tools=tools,
                store=False,
            )
        except OpenAIError as error:
            logger.error(f"[OpenAI Provider] API call failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise classify_provider_error(error, "openai", model) from error
        except Exception as error:
            logger.error(f"[OpenAI Provider] Unexpected failure calling model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise classify_provider_error(error, "openai", model) from error
        return self._response_from(response)

    def call_stream(
        self,
        model: str,
        instructions: str,
        conversation: Any,
        tools: list[dict[str, Any]],
    ):
        try:
            stream = self.client.responses.create(
                model=model,
                instructions=instructions,
                input=conversation,
                tools=tools,
                store=False,
                stream=True,
            )
        except OpenAIError as error:
            logger.error(f"[OpenAI Provider] Streaming call failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise classify_provider_error(error, "openai", model) from error
        except Exception as error:
            logger.error(f"[OpenAI Provider] Unexpected streaming failure for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise classify_provider_error(error, "openai", model) from error

        try:
            for event in stream:
                event_type = getattr(event, "type", "")
                if event_type == "response.output_text.delta":
                    delta_text = getattr(event, "delta", "") or ""
                    if delta_text:
                        yield StreamChunk(kind="text_delta", text=delta_text)
                elif event_type in ("response.reasoning.delta", "response.reasoning_text.delta"):
                    # Reasoning/thinking deltas for o1/o3/gpt-5 reasoning models
                    delta_text = getattr(event, "delta", "") or ""
                    if delta_text:
                        yield StreamChunk(kind="thinking_delta", text=delta_text)
                elif event_type == "response.completed":
                    completed = getattr(event, "response", None)
                    if completed is None:
                        raise AIServiceError("OpenAI stream completed without a response payload.")
                    yield StreamChunk(kind="final", response=self._response_from(completed))
                # function_call deltas are aggregated in the final response for simplicity
        except AIServiceError:
            raise
        except Exception as error:
            logger.error(f"[OpenAI Provider] Streaming iteration failed for model '{model}': {type(error).__name__}: {error}", exc_info=True)
            raise classify_provider_error(error, "openai", model) from error

    def continuation(self, response: ProviderResponse) -> list[Any]:
        return list(response.raw.output)

    def tool_result_blocks(self, call: ToolCall, output: str) -> list[Any]:
        return [
            {
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": output,
            }
        ]
