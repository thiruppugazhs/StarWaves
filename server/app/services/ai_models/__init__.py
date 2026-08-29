from app.services.ai_models.anthropic import AnthropicProviderClient
from app.services.ai_models.catalog import (
    AI_MODELS_SETTINGS_DOC,
    AI_PROVIDERS,
    DEFAULT_PROVIDER,
    MAX_TOOL_ROUNDS,
    validate_preference,
)
from app.services.ai_models.config import (
    any_provider_available,
    effective_api_key,
    has_server_key,
    invalidate_ai_config_cache,
    load_ai_preference,
    resolve_ai_config,
)
from app.services.ai_models.contracts import AIServiceError, AiConfig, ProviderClient
from app.services.ai_models.discovery import fetch_provider_models, provider_catalog
from app.services.ai_models.gemini import GeminiProviderClient
from app.services.ai_models.loop import run_tool_loop, run_tool_loop_stream
from app.services.ai_models.openai import OpenAiProviderClient
from app.services.ai_models.openai_compat import OpenAiCompatibleClient

PROVIDER_CLIENTS = {
    "openai": OpenAiProviderClient,
    "anthropic": AnthropicProviderClient,
    "gemini": GeminiProviderClient,
    "openrouter": OpenAiCompatibleClient,
    "ollama": OpenAiCompatibleClient,
    "opencode": OpenAiCompatibleClient,
}


def get_provider_client(config: AiConfig) -> ProviderClient:
    """Instantiate the provider client for an AiConfig (matches chat_context pattern)."""
    cls = PROVIDER_CLIENTS.get(config.provider)
    if cls is None:
        raise ValueError(f"Unsupported AI provider '{config.provider}'.")
    return cls(config.client_options)


__all__ = [
    "AI_MODELS_SETTINGS_DOC",
    "AI_PROVIDERS",
    "AIServiceError",
    "AiConfig",
    "DEFAULT_PROVIDER",
    "MAX_TOOL_ROUNDS",
    "PROVIDER_CLIENTS",
    "ProviderClient",
    "any_provider_available",
    "effective_api_key",
    "fetch_provider_models",
    "get_provider_client",
    "has_server_key",
    "invalidate_ai_config_cache",
    "load_ai_preference",
    "provider_catalog",
    "resolve_ai_config",
    "run_tool_loop",
    "run_tool_loop_stream",
    "validate_preference",
]
