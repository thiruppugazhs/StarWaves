"""Live model discovery — single responsibility: fetch each provider's available
models from its list API (with a short TTL cache) and assemble the provider
catalog payload returned to the frontend."""

import logging
import time
from typing import Any

from app.core.http import create_async_client
import httpx

from app.services.ai_models.catalog import AI_PROVIDERS, PROVIDER_DEFAULT_BASE_URLS, _format_model_label
from app.services.ai_models.config import has_server_key, effective_api_key, effective_base_url

logger = logging.getLogger(__name__)

# Cache for live model listings to avoid hammering provider APIs
_LIVE_MODEL_TTL = 300  # seconds
_live_model_cache: dict[str, tuple[float, list[dict[str, str]]]] = {}

# Model ids filtered out of generic /v1/models lists (non-chat endpoints)
_NON_CHAT_MODEL_KEYWORDS = ("embed", "whisper", "tts", "dall", "audio", "realtime", "transcribe", "moderation")
# OpenAI has expanded prefixes: gpt-3/4/5, o1/o3/o4, chatgpt, gpt-*. 2026 catalog includes
# gpt-5.6-*, o4-mini, etc. Keep broad `gpt-` to avoid hiding new chat models.
_OPENAI_MODEL_PREFIXES = ("gpt-", "o1", "o3", "o4", "chatgpt", "gpt-3", "gpt-4", "gpt-5")


def _live_cache_get(provider: str, api_key: str) -> list[dict[str, str]] | None:
    # Placeholder "ollama" key must not collide with real keys; truncate safely
    cache_key = api_key[:8] if api_key and api_key != "ollama" else api_key or "anon"
    key = f"{provider}:{cache_key}"
    entry = _live_model_cache.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def _live_cache_set(provider: str, api_key: str, models: list[dict[str, str]]) -> None:
    cache_key = api_key[:8] if api_key and api_key != "ollama" else api_key or "anon"
    key = f"{provider}:{cache_key}"
    _live_model_cache[key] = (time.monotonic() + _LIVE_MODEL_TTL, models)


async def _get_models_json(
    provider: str,
    url: str,
    headers: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    """GET a provider's models endpoint and return parsed JSON, or None on failure."""
    try:
        async with create_async_client(timeout=httpx.Timeout(6.0, connect=3.0)) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            # Ollama local not running is expected — downgrade to debug
            if provider == "ollama":
                logger.info(f"[AI Models] ollama list models failed {resp.status_code} (local not running, use OLLAMA_URL for cloud)")
            else:
                logger.warning(f"[AI Models] {provider} list models failed {resp.status_code}: {resp.text[:200]}")
            return None
        return resp.json()
    except Exception as error:
        if provider == "ollama":
            logger.info(f"[AI Models] ollama list skipped (local not running): {error} — set OLLAMA_URL for cloud")
        else:
            logger.warning(f"[AI Models] {provider} list exception: {error}")
        return None


async def _fetch_openai_models(api_key: str, base_url: str | None = None) -> list[dict[str, str]]:
    url = f"{(base_url or 'https://api.openai.com/v1').rstrip('/')}/models"
    data = await _get_models_json("OpenAI", url, headers={"Authorization": f"Bearer {api_key}"})
    if data is None:
        return []
    models: list[dict[str, str]] = []
    is_official_openai = not base_url or "api.openai.com" in base_url
    for item in data.get("data") or []:
        mid = item.get("id") or ""
        if not mid:
            continue
        low = mid.lower()
        # Filter to chat/completion models only
        if any(keyword in low for keyword in _NON_CHAT_MODEL_KEYWORDS):
            continue
        if is_official_openai and not low.startswith(_OPENAI_MODEL_PREFIXES):
            continue
        models.append({"id": mid, "label": _format_model_label(mid)})
    return sorted(models, key=lambda entry: entry["id"])


async def _fetch_gemini_models(api_key: str) -> list[dict[str, str]]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    data = await _get_models_json("Gemini", url)
    if data is None:
        return []
    models: list[dict[str, str]] = []
    for item in data.get("models") or []:
        mid = (item.get("name") or "").replace("models/", "")  # e.g. models/gemini-2.5-flash
        if not mid:
            continue
        # Keep every chat-capable model the provider lists (Gemini, Gemma, LearnLM, …)
        if "generateContent" not in (item.get("supportedGenerationMethods") or []):
            continue
        label = item.get("displayName") or _format_model_label(mid)
        models.append({"id": mid, "label": label})
    return sorted(models, key=lambda entry: entry["id"])


async def _fetch_anthropic_models(api_key: str) -> list[dict[str, str]]:
    data = await _get_models_json(
        "Anthropic",
        "https://api.anthropic.com/v1/models",
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
    )
    if data is None:
        return []
    models: list[dict[str, str]] = []
    for item in data.get("data") or []:
        mid = item.get("id") or item.get("name") or ""
        if not mid or "claude" not in mid.lower():
            continue
        label = item.get("display_name") or _format_model_label(mid)
        models.append({"id": mid, "label": label})
    return sorted(models, key=lambda entry: entry["id"])


async def _fetch_openai_compatible_models(api_key: str, base_url: str, provider: str) -> list[dict[str, str]]:
    """List models from any OpenAI-compatible /v1/models endpoint (OpenRouter, Ollama, OpenCode)."""
    # Ollama placeholder "ollama" must not send auth — local Ollama ignores or rejects it
    if api_key == "ollama":
        headers = None
    else:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
    # OpenRouter benefits from Referer/Title headers (ranking, free-tier)
    if provider == "openrouter" and headers is not None:
        from app.core.config import settings as _settings

        headers = {**headers, "HTTP-Referer": _settings.frontend_url, "X-Title": "Starwaves"}
    elif provider == "openrouter" and headers is None:
        from app.core.config import settings as _settings

        headers = {"HTTP-Referer": _settings.frontend_url, "X-Title": "Starwaves"}
    data = await _get_models_json(provider, f"{base_url.rstrip('/')}/models", headers=headers)
    if data is None:
        return []
    models: list[dict[str, str]] = []
    for item in data.get("data") or []:
        mid = item.get("id") or ""
        if not mid or any(keyword in mid.lower() for keyword in _NON_CHAT_MODEL_KEYWORDS):
            continue
        label = item.get("name") or _format_model_label(mid)
        models.append({"id": mid, "label": label})
    return sorted(models, key=lambda entry: entry["id"])


async def fetch_provider_models(
    provider: str, api_key: str | None = None, user_keys: dict[str, str] | None = None
) -> list[dict[str, str]]:
    effective = api_key or effective_api_key(provider, user_keys or {})
    # OpenAI-compatible providers can list models with only a base_url (Ollama local, OpenCode) — don't block on missing key
    if not effective and provider not in ("ollama", "opencode", "openrouter", "groq"):
        return []
    # For compatible providers without a key, attempt unauthenticated fetch via base_url
    # Preserve placeholder "ollama" to avoid sending Bearer ollama
    effective = effective if effective is not None else ""
    cached = _live_cache_get(provider, effective)
    if cached is not None:
        return cached
    base_url = effective_base_url(provider)
    if provider == "openai":
        models = await _fetch_openai_models(effective, base_url)
    elif provider == "gemini":
        models = await _fetch_gemini_models(effective)
    elif provider == "anthropic":
        models = await _fetch_anthropic_models(effective)
    elif provider == "groq":
        models = await _fetch_openai_compatible_models(
            effective, base_url or PROVIDER_DEFAULT_BASE_URLS["groq"], provider
        )
    elif provider in ("openrouter", "ollama", "opencode"):
        models = await _fetch_openai_compatible_models(
            effective, base_url or PROVIDER_DEFAULT_BASE_URLS[provider], provider
        )
    else:
        return []
    if models:
        _live_cache_set(provider, effective, models)
    return models


async def provider_catalog(user_api_keys: dict[str, str] | None = None) -> list[dict[str, Any]]:
    keys = user_api_keys or {}
    catalog = [
        {
            "id": "default",
            "label": "Default",
            "available": any(has_server_key(provider) for provider in AI_PROVIDERS),
            "env_configured": True,
            "is_default": True,
            "has_user_key": False,
            "default_model": "default",
            "models": [
                {
                    "id": "default",
                    "label": "Default",
                    "is_default": True,
                }
            ],
        }
    ]
    for provider_id, descriptor in AI_PROVIDERS.items():
        # Try live API list when possible, fallback to static catalog / default model so dropdown never empty
        live_models: list[dict[str, str]] = []
        # Always attempt live fetch for compatible providers (may work without key), otherwise only when key exists
        should_try_live = provider_id in ("ollama", "opencode", "openrouter", "groq") or bool(effective_api_key(provider_id, keys))
        if should_try_live:
            try:
                live_models = await fetch_provider_models(provider_id, effective_api_key(provider_id, keys), keys)
            except Exception:
                live_models = []
        # Fallback: if live empty, show default_model as single entry so dropdown is never blank
        chosen_models = live_models if live_models else []
        if not chosen_models:
            # Use descriptor static models if defined, else default_model single entry
            static = descriptor.get("models") or []
            if static:
                chosen_models = static
            elif descriptor.get("default_model"):
                chosen_models = [{"id": descriptor["default_model"], "label": _format_model_label(descriptor["default_model"])}]
        default_id = descriptor["default_model"]
        models_payload = [
            {
                "id": item["id"],
                "label": item.get("label") or _format_model_label(item["id"]),
                "is_default": item["id"] == default_id,
            }
            for item in chosen_models
        ]
        catalog.append({
            "id": provider_id,
            "label": descriptor["label"],
            "available": bool(keys.get(provider_id)) or has_server_key(provider_id),
            "env_configured": has_server_key(provider_id),
            "is_default": False,
            "has_user_key": bool(keys.get(provider_id)),
            "default_model": descriptor["default_model"],
            "models": models_payload,
        })
    return catalog
