"""AI config resolution — single responsibility: resolve each user's provider/model
choice into an AiConfig with working credentials and client options."""

import time
from typing import Any

from app.db import SqlClient

from app.core.config import settings
from app.services.ai_models.catalog import AI_PROVIDERS, AI_MODELS_SETTINGS_DOC, DEFAULT_PROVIDER, PROVIDER_DEFAULT_BASE_URLS
from app.services.ai_models.contracts import AiConfig

_AI_CACHE_TTL = 60  # seconds
_ai_config_cache: dict[str, tuple[float, AiConfig]] = {}


def has_server_key(provider: str) -> bool:
    if provider == "openai":
        return bool(settings.openai_api_key)
    if provider == "anthropic":
        return bool(settings.anthropic_api_key)
    if provider == "gemini":
        return bool(settings.gemini_api_key)
    if provider == "openrouter":
        return bool(settings.openrouter_api_key)
    if provider == "groq":
        return bool(settings.groq_api_key)
    if provider == "ollama":
        # Ollama is local or cloud — available when URL or API key is configured
        return bool(settings.ollama_url or settings.ollama_api_key)
    if provider == "opencode":
        return bool(settings.opencode_api_key)
    return False


def any_provider_available() -> bool:
    return any(has_server_key(provider) for provider in AI_PROVIDERS)


def effective_api_key(provider: str, user_keys: dict[str, str]) -> str | None:
    """Return the user's stored key for the provider, else the server env key."""
    if user_keys.get(provider):
        return user_keys[provider]
    if provider == "openai":
        return settings.openai_api_key
    if provider == "anthropic":
        return settings.anthropic_api_key
    if provider == "gemini":
        return settings.gemini_api_key
    if provider == "openrouter":
        return settings.openrouter_api_key
    if provider == "groq":
        return settings.groq_api_key
    if provider == "ollama":
        # Only return a key when Ollama is actually configured (local URL or explicit key)
        # Otherwise return None so discovery doesn't spam local 127.0.0.1 warnings
        if user_keys.get("ollama"):
            return user_keys["ollama"]
        if settings.ollama_api_key:
            return settings.ollama_api_key
        if settings.ollama_url:
            return "ollama"  # placeholder for OpenAI-compatible client when URL is set
        return None
    if provider == "opencode":
        return settings.opencode_api_key
    return None


def effective_base_url(provider: str) -> str | None:
    if provider == "openai":
        return settings.openai_url or PROVIDER_DEFAULT_BASE_URLS["openai"]
    if provider == "anthropic":
        return settings.anthropic_url
    if provider == "gemini":
        return settings.gemini_url
    if provider == "openrouter":
        return settings.openrouter_url or PROVIDER_DEFAULT_BASE_URLS["openrouter"]
    if provider == "groq":
        return settings.groq_url or PROVIDER_DEFAULT_BASE_URLS["groq"]
    if provider == "ollama":
        return settings.ollama_url or PROVIDER_DEFAULT_BASE_URLS["ollama"]
    if provider == "opencode":
        return settings.opencode_url or PROVIDER_DEFAULT_BASE_URLS["opencode"]
    return None


def _client_options(provider: str, user_api_key: str | None = None) -> dict[str, Any]:
    api_key = user_api_key or effective_api_key(provider, {})

    options: dict[str, Any] = {}
    if api_key:
        options["api_key"] = api_key
    elif provider == "ollama":
        # Ollama needs a placeholder key for the OpenAI SDK
        options["api_key"] = "ollama"

    base_url = effective_base_url(provider)
    if base_url:
        options["base_url"] = base_url
    return options


def build_ai_config(
    provider: str = DEFAULT_PROVIDER,
    model: str | None = None,
    user_api_key: str | None = None,
) -> AiConfig:
    if provider in ("default", "", None) or provider not in AI_PROVIDERS:
        provider = DEFAULT_PROVIDER
        user_api_key = None
    elif not user_api_key and not has_server_key(provider):
        provider = DEFAULT_PROVIDER
        user_api_key = None

    descriptor = AI_PROVIDERS[provider]
    # Accept any live model id; only fallback when empty/default
    if not model or model == "default":
        model = descriptor["default_model"]
    return AiConfig(
        provider=provider,
        model=model,
        client_options=_client_options(provider, user_api_key=user_api_key),
    )


def _preference_reference(database: SqlClient, user_uid: str):
    return (
        database.collection("users")
        .document(user_uid)
        .collection("settings")
        .document(AI_MODELS_SETTINGS_DOC)
    )


def load_ai_preference(database: SqlClient, user_uid: str) -> dict[str, Any] | None:
    snapshot = _preference_reference(database, user_uid).get()
    if not snapshot.exists:
        return None
    return snapshot.to_dict() or None


def _cache_get(user_uid: str) -> AiConfig | None:
    entry = _ai_config_cache.get(user_uid)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def _cache_set(user_uid: str, config: AiConfig) -> None:
    _ai_config_cache[user_uid] = (time.monotonic() + _AI_CACHE_TTL, config)


def invalidate_ai_config_cache(user_uid: str) -> None:
    _ai_config_cache.pop(user_uid, None)


def resolve_ai_config(database: SqlClient, user_uid: str) -> AiConfig:
    """Resolve a user's AI provider/model choice, falling back to the server default."""
    cached = _cache_get(user_uid)
    if cached is not None:
        return cached
    preference = load_ai_preference(database, user_uid)
    if not preference:
        cfg = build_ai_config("default")
        _cache_set(user_uid, cfg)
        return cfg

    chosen_provider = preference.get("provider") or "default"
    if chosen_provider == "default":
        cfg = build_ai_config("default")
        _cache_set(user_uid, cfg)
        return cfg

    model = preference.get("model")
    user_api_key = None
    api_keys = preference.get("api_keys") or {}
    if isinstance(api_keys, dict) and chosen_provider in api_keys:
        user_api_key = api_keys.get(chosen_provider)
    elif preference.get("api_key") and preference.get("provider") == chosen_provider:
        user_api_key = preference.get("api_key")

    cfg = build_ai_config(chosen_provider, model, user_api_key=user_api_key)
    _cache_set(user_uid, cfg)
    return cfg
