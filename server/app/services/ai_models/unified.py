"""Unified live model registry — aggregates every provider's /v1/models endpoint.

Covers the user's requested shape:
  model ID, input_modalities, output_modalities, context_window, streaming,
  TTS/STT/image, pricing, free.

Uses live endpoints (no scraping):
  - OpenAI GET /v1/models (Bearer)
  - Anthropic GET /v1/models (x-api-key)
  - Gemini GET /v1beta/models?key=...
  - Groq GET /openai/v1/models (Bearer, OpenAI-compatible)
  - OpenRouter GET /api/v1/models (Bearer) — richest: pricing, context_length, architecture, supported_parameters
"""

import asyncio
import logging
import time
from typing import Any

import httpx

from app.core.config import settings
from app.services.ai_models.catalog import AI_PROVIDERS, _format_model_label
from app.services.ai_models.config import effective_api_key
from app.services.ai_models.discovery import _get_models_json, _live_cache_get, _live_cache_set

logger = logging.getLogger(__name__)

_UNIFIED_TTL = 300
_unified_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _is_free_pricing(pricing: dict[str, Any] | None) -> bool:
    if not pricing:
        return False
    try:
        prompt = float(pricing.get("prompt", "1") or 0)
        completion = float(pricing.get("completion", "1") or 0)
        return prompt == 0 and completion == 0
    except Exception:
        return False


def _detect_modalities(model_id: str, raw: dict[str, Any]) -> dict[str, Any]:
    """Best-effort modality detection from id + raw endpoint fields."""
    low = model_id.lower()
    architecture = raw.get("architecture") or {}
    input_mods = architecture.get("input_modalities") or []
    output_mods = architecture.get("output_modalities") or []

    # Fallback heuristics when endpoint doesn't expose architecture
    if not input_mods:
        input_mods = ["text"]
        if any(k in low for k in ("whisper", "transcribe", "stt", "audio")):
            input_mods = ["audio"]
        if "vision" in low or "image" in low:
            input_mods.append("image")
    if not output_mods:
        if any(k in low for k in ("tts", "speech", "audio", "fish-audio", "s2", "s1", "kokoro")):
            output_mods = ["speech"]
        elif "whisper" in low or "transcribe" in low:
            output_mods = ["text"]
        else:
            output_mods = ["text"]

    supports_tts = "speech" in output_mods or "audio" in output_mods or any(k in low for k in ("tts", "speech", "s2.1", "fish-audio", "kokoro", "lyria"))
    supports_stt = "audio" in input_mods or any(k in low for k in ("whisper", "transcribe", "stt"))
    supports_image = "image" in input_mods or "image" in output_mods or "vision" in low
    supports_streaming = True  # most chat/TTS endpoints support streaming; refine via supported_parameters if present
    params = raw.get("supported_parameters") or []
    if params and "stream" not in [str(p).lower() for p in params]:
        # OpenRouter explicitly lists streaming support via supported_parameters
        pass

    return {
        "input_modalities": input_mods,
        "output_modalities": output_mods,
        "supports_tts": supports_tts,
        "supports_stt": supports_stt,
        "supports_image": supports_image,
        "supports_streaming": supports_streaming,
    }


async def _fetch_openai_unified(api_key: str, base_url: str | None) -> list[dict[str, Any]]:
    url = f"{(base_url or 'https://api.openai.com/v1').rstrip('/')}/models"
    data = await _get_models_json("OpenAI", url, headers={"Authorization": f"Bearer {api_key}"})
    if data is None:
        return []
    out: list[dict[str, Any]] = []
    for item in data.get("data") or []:
        mid = item.get("id") or ""
        if not mid:
            continue
        mods = _detect_modalities(mid, item)
        out.append({
            "provider": "openai",
            "id": mid,
            "label": _format_model_label(mid),
            "context_window": item.get("context_window") or item.get("context_length"),
            "pricing": None,
            "is_free": False,
            **mods,
            "raw": {"created": item.get("created"), "owned_by": item.get("owned_by")},
        })
    return out


async def _fetch_anthropic_unified(api_key: str) -> list[dict[str, Any]]:
    data = await _get_models_json("Anthropic", "https://api.anthropic.com/v1/models", headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"})
    if data is None:
        return []
    out: list[dict[str, Any]] = []
    for item in data.get("data") or []:
        mid = item.get("id") or item.get("name") or ""
        if not mid:
            continue
        mods = _detect_modalities(mid, item)
        out.append({
            "provider": "anthropic",
            "id": mid,
            "label": item.get("display_name") or _format_model_label(mid),
            "context_window": None,
            "pricing": None,
            "is_free": False,
            **mods,
            "raw": {"created_at": item.get("created_at")},
        })
    return out


async def _fetch_gemini_unified(api_key: str) -> list[dict[str, Any]]:
    data = await _get_models_json("Gemini", f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}")
    if data is None:
        return []
    out: list[dict[str, Any]] = []
    for item in data.get("models") or []:
        mid = (item.get("name") or "").replace("models/", "")
        if not mid:
            continue
        mods = _detect_modalities(mid, item)
        ctx = item.get("inputTokenLimit")
        pricing = None
        out.append({
            "provider": "gemini",
            "id": mid,
            "label": item.get("displayName") or _format_model_label(mid),
            "context_window": ctx,
            "pricing": pricing,
            "is_free": False,
            **mods,
            "raw": {"supportedGenerationMethods": item.get("supportedGenerationMethods")},
        })
    return out


async def _fetch_openrouter_unified(api_key: str | None, base_url: str | None) -> list[dict[str, Any]]:
    base = (base_url or "https://openrouter.ai/api/v1").rstrip("/")
    headers: dict[str, str] | None = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    # OpenRouter ranking headers — also required for free-tier model listing
    from app.core.config import settings as _s

    headers = {**(headers or {}), "HTTP-Referer": _s.frontend_url, "X-Title": "Starwaves"}
    # OpenRouter's default /models omits speech; must also fetch ?output_modalities=speech
    urls = [f"{base}/models", f"{base}/models?output_modalities=speech"]
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for url in urls:
        data = await _get_models_json("OpenRouter", url, headers=headers)
        if data is None:
            continue
        for item in data.get("data") or []:
            mid = item.get("id") or ""
            if not mid or mid in seen:
                continue
            seen.add(mid)
            pricing = item.get("pricing") or {}
            mods = _detect_modalities(mid, item)
            ctx = item.get("context_length")
            is_free = _is_free_pricing(pricing) or mid.endswith(":free")
            out.append({
                "provider": "openrouter",
                "id": mid,
                "label": item.get("name") or _format_model_label(mid),
                "context_window": ctx,
                "pricing": pricing,
                "is_free": is_free,
                **mods,
                "raw": {
                    "architecture": item.get("architecture"),
                    "supported_parameters": item.get("supported_parameters"),
                },
            })
    return out


async def _fetch_groq_unified(api_key: str, base_url: str | None) -> list[dict[str, Any]]:
    url = f"{(base_url or 'https://api.groq.com/openai/v1').rstrip('/')}/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = await _get_models_json("Groq", url, headers=headers)
    if data is None:
        return []
    out: list[dict[str, Any]] = []
    for item in data.get("data") or []:
        mid = item.get("id") or ""
        if not mid:
            continue
        mods = _detect_modalities(mid, item)
        out.append({
            "provider": "groq",
            "id": mid,
            "label": item.get("display_name") or _format_model_label(mid),
            "context_window": item.get("context_window") or item.get("context_length"),
            "pricing": None,
            "is_free": False,
            **mods,
            "raw": {"owned_by": item.get("owned_by"), "created": item.get("created")},
        })
    return out


async def _fetch_openai_compat_unified(provider: str, api_key: str | None, base_url: str) -> list[dict[str, Any]]:
    # Placeholder "ollama" must not send Bearer
    if api_key == "ollama":
        hdrs = None
    else:
        hdrs = {"Authorization": f"Bearer {api_key}"} if api_key else None
    data = await _get_models_json(provider, f"{base_url.rstrip('/')}/models", headers=hdrs)
    if data is None:
        return []
    out: list[dict[str, Any]] = []
    for item in data.get("data") or []:
        mid = item.get("id") or ""
        if not mid:
            continue
        mods = _detect_modalities(mid, item)
        out.append({
            "provider": provider,
            "id": mid,
            "label": item.get("name") or _format_model_label(mid),
            "context_window": item.get("context_length") or item.get("context_window"),
            "pricing": item.get("pricing"),
            "is_free": _is_free_pricing(item.get("pricing")) or mid.endswith(":free"),
            **mods,
            "raw": {},
        })
    return out


async def discover_all_models(user_keys: dict[str, str] | None = None, include_free_only: bool = False) -> list[dict[str, Any]]:
    """Query every configured provider's live endpoint and return a unified list.

    Results are cached 5min per API key. Providers without a key are skipped
    (their static fallback is not included — use provider_catalog for that).
    """
    keys = user_keys or {}
    cache_key = f"unified:{'|'.join(sorted(f'{k}:{v[:4]}' for k, v in keys.items()))}:{include_free_only}"
    entry = _unified_cache.get(cache_key)
    if entry and entry[0] > time.monotonic():
        return entry[1]

    tasks: list[Any] = []
    provider_names: list[str] = []

    def add(coro: Any, name: str) -> None:
        tasks.append(coro)
        provider_names.append(name)

    # Hit every provider; OpenRouter is public (no key required), others need a key.
    for provider_id in list(AI_PROVIDERS.keys()):
        api_key = effective_api_key(provider_id, keys)
        # OpenRouter models listing is public — allow unauthenticated fetch
        if not api_key and provider_id != "openrouter":
            continue
        base_url = None
        try:
            from app.services.ai_models.config import effective_base_url
            base_url = effective_base_url(provider_id)
        except Exception:
            pass
        if provider_id == "openai":
            add(_fetch_openai_unified(api_key or "", base_url), "openai")
        elif provider_id == "anthropic":
            add(_fetch_anthropic_unified(api_key or ""), "anthropic")
        elif provider_id == "gemini":
            add(_fetch_gemini_unified(api_key or ""), "gemini")
        elif provider_id == "openrouter":
            add(_fetch_openrouter_unified(api_key, base_url), "openrouter")
        elif provider_id == "groq":
            add(_fetch_groq_unified(api_key or "", base_url), "groq")
        elif provider_id in ("ollama", "opencode"):
            # Generic OpenAI-compatible — skip placeholder auth
            from app.services.ai_models.catalog import PROVIDER_DEFAULT_BASE_URLS

            url = base_url or PROVIDER_DEFAULT_BASE_URLS.get(provider_id, "")
            if url:
                add(_fetch_openai_compat_unified(provider_id, api_key if api_key != "ollama" else None, url), provider_id)

    if not tasks:
        return []

    results = await asyncio.gather(*tasks, return_exceptions=True)
    unified: list[dict[str, Any]] = []
    for provider_name, result in zip(provider_names, results):
        if isinstance(result, Exception):
            logger.warning(f"[Unified Models] {provider_name} failed: {result}")
            continue
        if isinstance(result, list):
            unified.extend(result)

    # Enrich with static fallback for providers not hit? No — live only.

    # Filter free if requested
    if include_free_only:
        unified = [m for m in unified if m.get("is_free")]

    # Sort: provider then id
    unified.sort(key=lambda m: (m["provider"], m["id"]))

    _unified_cache[cache_key] = (time.monotonic() + _UNIFIED_TTL, unified)
    return unified
