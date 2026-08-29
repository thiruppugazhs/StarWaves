"""AI provider contracts — single responsibility: shared types and the provider adapter interface.

Provider adapters (openai.py, anthropic.py, gemini.py, openai_compat.py) subclass
ProviderClient so the shared tool loops in loop.py stay provider-agnostic.
"""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any


class AIServiceError(RuntimeError):
    """Raised when an AI provider cannot complete a request."""


@dataclass
class AiConfig:
    provider: str
    model: str
    client_options: dict[str, Any]


@dataclass
class ToolCall:
    call_id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ProviderResponse:
    text: str | None
    tool_calls: list[ToolCall]
    raw: Any = None


@dataclass
class StreamChunk:
    """One streamed provider event: incremental text, incremental thinking, or the complete response.

    Providers yield zero or more ``text_delta`` or ``thinking_delta`` chunks followed by
    exactly one ``final`` chunk carrying the same ProviderResponse shape as a non-streaming
    call, so the shared tool loop stays provider-agnostic.
    """

    kind: str  # "text_delta" | "thinking_delta" | "final"
    text: str = ""
    response: ProviderResponse | None = None


class ProviderClient:
    """Adapter interface for an AI provider's tool-calling SDK.

    Subclasses implement build_client, normalize_messages, call,
    continuation, and tool_result_blocks so the shared tool loop in
    run_tool_loop stays provider-agnostic.
    """

    def __init__(self, client_options: dict[str, Any]):
        self.client = self.build_client(client_options)

    def build_client(self, client_options: dict[str, Any]) -> Any:
        raise NotImplementedError

    def normalize_messages(self, messages: list[dict[str, str]]) -> Any:
        raise NotImplementedError

    def call(
        self,
        model: str,
        instructions: str,
        conversation: Any,
        tools: list[dict[str, Any]],
    ) -> ProviderResponse:
        raise NotImplementedError

    def call_stream(
        self,
        model: str,
        instructions: str,
        conversation: Any,
        tools: list[dict[str, Any]],
    ) -> Iterator[StreamChunk]:
        raise NotImplementedError

    def continuation(self, response: ProviderResponse) -> list[Any]:
        raise NotImplementedError

    def tool_result_blocks(self, call: ToolCall, output: str) -> list[Any]:
        raise NotImplementedError
