"""AI provider catalog — single responsibility: the static provider/model catalog
and preference validation."""

from typing import Any

from app.core.config import settings

MAX_TOOL_ROUNDS = 6
# Resolved at import; stays "openai" universally per ADR 0005. Dynamic fallback
# to first available provider lives in config._first_available_provider().
DEFAULT_PROVIDER = settings.default_ai_provider
AI_MODELS_SETTINGS_DOC = "ai-models"

# Default base URLs for OpenAI-compatible providers
PROVIDER_DEFAULT_BASE_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "groq": "https://api.groq.com/openai/v1",
    "ollama": "http://127.0.0.1:11434/v1",
    "opencode": "https://opencode.ai/zen/v1",
}

# Curated catalog of AI providers and their supported models. The server must
# have an API key configured for a provider before it can be used (env vars),
# but the catalog itself is always returned to the frontend for display.
# Providers using an OpenAI-compatible /chat/completions API are marked
# "openai_compatible" and share OpenAiCompatibleClient.
AI_PROVIDERS: dict[str, dict[str, Any]] = {
    "openai": {
        "label": "OpenAI",
        "default_model": settings.openai_model,
        "models": [],  # API-only — no static fallback
    },
    "anthropic": {
        "label": "Anthropic",
        "default_model": settings.anthropic_model,
        "models": [],  # API-only — no static fallback
    },
    "gemini": {
        "label": "Google Gemini",
        "default_model": settings.gemini_model,
        "models": [],  # API-only — no static fallback
    },
    "openrouter": {
        "label": "OpenRouter",
        "default_model": settings.openrouter_model,
        "openai_compatible": True,
        "requires_base_url": True,
        "models": [],  # API-only — no static fallback
    },
    "groq": {
        "label": "Groq",
        "default_model": settings.groq_model,
        "openai_compatible": True,
        "requires_base_url": True,
        "models": [],  # API-only — no static fallback
    },
    "ollama": {
        "label": "Ollama (local)",
        "default_model": settings.ollama_model,
        "openai_compatible": True,
        "requires_base_url": True,
        "models": [],  # API-only — no static fallback
    },
    "opencode": {
        "label": "OpenCode",
        "default_model": settings.opencode_model,
        "openai_compatible": True,
        "requires_base_url": True,
        "models": [],  # API-only — no static fallback
    },
}


def validate_preference(provider: str, model: str) -> bool:
    if provider == "default":
        return model in ("default", "", None)
    descriptor = AI_PROVIDERS.get(provider)
    if not descriptor:
        return False
    # Allow any non-empty model id for known provider (live API may expose models beyond static catalog)
    return isinstance(model, str) and len(model.strip()) > 0


def _format_model_label(model_id: str) -> str:
    raw = model_id.replace("models/", "")
    parts = raw.replace("-", " ").replace("_", " ").split()
    return " ".join(word.capitalize() if word.isalpha() else word for word in parts)
