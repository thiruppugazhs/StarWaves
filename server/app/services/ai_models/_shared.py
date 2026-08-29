"""Backward-compatibility facade for the split ai_models modules.

New code should import from the owning module directly:
- contracts: shared types and the provider adapter interface
- catalog: static provider/model catalog, defaults, preference validation
- config: credential/config resolution per user
- discovery: live model listing and provider catalog payload
- loop: provider tool-calling loops (blocking and streaming)
"""

from app.services.ai_models.catalog import (
    AI_MODELS_SETTINGS_DOC,
    AI_PROVIDERS,
    DEFAULT_PROVIDER,
    MAX_TOOL_ROUNDS,
    PROVIDER_DEFAULT_BASE_URLS,
    _format_model_label,
    validate_preference,
)
from app.services.ai_models.config import (
    any_provider_available,
    build_ai_config,
    effective_api_key,
    effective_base_url,
    has_server_key,
    invalidate_ai_config_cache,
    load_ai_preference,
    resolve_ai_config,
)
from app.services.ai_models.contracts import (
    AIServiceError,
    AiConfig,
    ProviderClient,
    ProviderResponse,
    StreamChunk,
    ToolCall,
)
from app.services.ai_models.discovery import (
    fetch_provider_models,
    provider_catalog,
)
from app.services.ai_models.loop import (
    run_tool_loop,
    run_tool_loop_stream,
)

__all__ = [
    "AI_MODELS_SETTINGS_DOC",
    "AI_PROVIDERS",
    "AIServiceError",
    "AiConfig",
    "DEFAULT_PROVIDER",
    "MAX_TOOL_ROUNDS",
    "PROVIDER_DEFAULT_BASE_URLS",
    "ProviderClient",
    "ProviderResponse",
    "StreamChunk",
    "ToolCall",
    "_format_model_label",
    "any_provider_available",
    "build_ai_config",
    "effective_api_key",
    "effective_base_url",
    "fetch_provider_models",
    "has_server_key",
    "invalidate_ai_config_cache",
    "load_ai_preference",
    "provider_catalog",
    "resolve_ai_config",
    "run_tool_loop",
    "run_tool_loop_stream",
    "validate_preference",
]
