"""AI provider contracts — single responsibility: shared types and the provider adapter interface.

Provider adapters (openai.py, anthropic.py, gemini.py, openai_compat.py) subclass
ProviderClient so the shared tool loops in loop.py stay provider-agnostic.
"""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any


class AIServiceError(RuntimeError):
    """Raised when an AI provider cannot complete a request.

    `kind` distinguishes user-actionable error classes so routes can return
    distinct HTTP status + messages (rate_limit → 429, auth → 401, etc.)
    while keeping the provider-agnostic tool loop intact.
    """

    def __init__(
        self,
        message: str,
        *,
        kind: str = "provider_error",
        status_code: int = 502,
        retry_after: int | None = None,
        provider: str | None = None,
    ):
        super().__init__(message)
        self.kind = kind
        self.status_code = status_code
        self.retry_after = retry_after
        self.provider = provider


def _extract_status_code(error: Exception) -> int | None:
    """Best-effort status code extraction from SDK errors (OpenAI/Anthropic/Gemini/httpx)."""
    for attr in ("status_code", "status", "code", "http_status"):
        val = getattr(error, attr, None)
        if isinstance(val, int) and 100 <= val <= 599:
            return val
        # Gemini APIError.code may be int or string like "429"
        if isinstance(val, str) and val.isdigit():
            try:
                n = int(val)
                if 100 <= n <= 599:
                    return n
            except Exception:
                pass
    # httpx Response buried in error.response
    resp = getattr(error, "response", None)
    if resp is not None:
        sc = getattr(resp, "status_code", None)
        if isinstance(sc, int):
            return sc
    return None


def classify_provider_error(error: Exception, provider: str, model: str | None = None) -> AIServiceError:
    """Map a raw SDK exception to a kinded AIServiceError with a user-facing message."""
    raw_msg = str(error) or type(error).__name__
    low = raw_msg.lower()
    status = _extract_status_code(error)

    # Explicit code checks + keyword fallbacks (covers string-only errors)
    is_rate = status == 429 or any(k in low for k in ("rate limit", "rate_limit", "429", "too many requests", "quota exceeded", "resource_exhausted", "capacity"))
    is_auth = status in (401, 403) or any(k in low for k in ("invalid_api_key", "authentication", "unauthorized", "api key", "permission denied"))
    is_notfound = status == 404 or any(k in low for k in ("model_not_found", "model not found", "does not exist", "unknown model"))
    is_context = any(k in low for k in ("context_length", "maximum context", "context window", "too many tokens", "input too long"))
    is_quota = status == 402 or "insufficient_quota" in low or "billing" in low or "payment required" in low
    is_server = status in (500, 502, 503, 504) or any(k in low for k in ("overloaded", "service unavailable", "internal server error", "temporarily unavailable"))

    # Retry-After extraction
    retry_after = None
    headers = getattr(error, "headers", None) or getattr(getattr(error, "response", None), "headers", None)
    if headers:
        try:
            ra = headers.get("retry-after") or headers.get("Retry-After")
            if ra:
                retry_after = int(str(ra).split(",")[0].strip())
        except Exception:
            pass

    label = provider.title() if provider else "AI provider"
    if is_rate:
        msg = f"{label} rate limit exceeded. Please wait {retry_after}s and retry." if retry_after else f"{label} rate limit exceeded. Please wait a moment and retry."
        # Groq/OpenRouter free tier often hits quota wording — keep as rate_limit for 429 UX
        return AIServiceError(msg, kind="rate_limit", status_code=429, retry_after=retry_after, provider=provider)
    if is_quota:
        msg = f"{label} quota exceeded. Please check billing or try a different provider/model in Settings > AI Models."
        return AIServiceError(msg, kind="quota", status_code=429, provider=provider)
    if is_auth:
        msg = f"{label} authentication failed. Please check your API key in Settings > AI Models or the server env ({provider.upper()}_API_KEY)."
        return AIServiceError(msg, kind="auth", status_code=401, provider=provider)
    if is_notfound:
        mid = f" '{model}'" if model else ""
        msg = f"Model{mid} not found for {label}. Please pick an available model in Settings > AI Models."
        return AIServiceError(msg, kind="model_not_found", status_code=404, provider=provider)
    if is_context:
        msg = f"{label} context limit exceeded. Please start a new chat or shorten the conversation."
        return AIServiceError(msg, kind="context_length", status_code=422, provider=provider)
    if is_server:
        msg = f"{label} is temporarily unavailable ({status or 'server error'}). Please retry shortly."
        return AIServiceError(msg, kind="server", status_code=503, provider=provider)

    # Fallback — preserve original detail but prefix provider
    msg = f"{label} error: {raw_msg}" if provider and provider.lower() not in low else raw_msg
    return AIServiceError(msg, kind="provider_error", status_code=status or 502, provider=provider)


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
