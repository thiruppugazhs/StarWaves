from fastapi import APIRouter, Depends, HTTPException, status
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_LONG, cache_invalidate_prefix, cached
from app.core.config import settings
from app.schemas.ai_models import AiModelsResponse, AiModelPreferenceUpdate
from app.services.ai_models import (
    AI_MODELS_SETTINGS_DOC,
    AI_PROVIDERS,
    DEFAULT_PROVIDER,
    effective_api_key,
    fetch_provider_models,
    has_server_key,
    invalidate_ai_config_cache,
    load_ai_preference,
    provider_catalog,
    validate_preference,
)

router = APIRouter(prefix="/settings/ai-models")

_AI_MODELS_PREFIX = "settings:ai-models"


def _invalidate_ai_models(user_id: str) -> None:
    cache_invalidate_prefix(f"{_AI_MODELS_PREFIX}:{user_id}")


def _reference(database: SqlClient, user_id: str):
    return (
        database.collection("users")
        .document(user_id)
        .collection("settings")
        .document(AI_MODELS_SETTINGS_DOC)
    )


def _extract_user_keys(preference: dict | None) -> dict[str, str]:
    if not preference:
        return {}
    keys: dict[str, str] = {}
    saved_keys = preference.get("api_keys")
    if isinstance(saved_keys, dict):
        keys.update({k: str(v) for k, v in saved_keys.items() if v})
    legacy_key = preference.get("api_key")
    saved_provider = preference.get("provider")
    if legacy_key and saved_provider and saved_provider not in keys:
        keys[saved_provider] = str(legacy_key)
    return keys


def _preference_payload(preference: dict | None, user_keys: dict[str, str]) -> dict | None:
    if not preference:
        return None
    provider = preference.get("provider") or "default"
    model = preference.get("model") or "default"
    return {
        "provider": provider,
        "model": model,
        "has_api_key": bool(user_keys.get(provider)),
        "assistant_name": preference.get("assistant_name") or "Eve",
    }


@router.get("", response_model=AiModelsResponse)
@cached(ttl=CACHE_TTL_LONG, prefix=_AI_MODELS_PREFIX)
async def get_ai_models(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    preference = load_ai_preference(database, user["uid"])
    user_keys = _extract_user_keys(preference)
    default_model = AI_PROVIDERS.get(DEFAULT_PROVIDER, {}).get("default_model", settings.openai_model)
    return {
        "providers": await provider_catalog(user_keys),
        "preference": _preference_payload(preference, user_keys),
        "default_provider": DEFAULT_PROVIDER,
        "default_model": default_model,
    }


@router.get("/models/{provider}")
async def list_provider_models(
    provider: str,
    api_key: str | None = None,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    preference = load_ai_preference(database, user["uid"])
    user_keys = _extract_user_keys(preference)
    # Use provided api_key if present, else stored user key / env key
    effective_key = api_key or user_keys.get(provider)
    if not effective_key:
        # Fall back to the server env-configured key for this provider
        effective_key = effective_api_key(provider, user_keys)
    if provider not in AI_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider")
    if not effective_key:
        # No key available — return static fallback list
        static = AI_PROVIDERS[provider]["models"]
        return {"provider": provider, "models": static}
    models = await fetch_provider_models(provider, effective_key, user_keys)
    if not models:
        # API returned empty — fallback to static so UI still usable
        static = AI_PROVIDERS[provider]["models"]
        return {"provider": provider, "models": static, "fallback": True}
    return {"provider": provider, "models": models}


@router.put("", response_model=AiModelsResponse)
async def save_ai_models(
    payload: AiModelPreferenceUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    if not validate_preference(payload.provider, payload.model):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unknown AI provider or model.",
        )

    current_pref = load_ai_preference(database, user["uid"])
    user_keys = _extract_user_keys(current_pref)
    is_default = payload.provider == "default"
    provider_descriptor = AI_PROVIDERS.get(payload.provider, {})
    provider_label = "Default" if is_default else provider_descriptor.get("label", payload.provider)
    has_env = is_default or has_server_key(payload.provider)

    api_key_to_save = payload.api_key.strip() if payload.api_key else None

    # Ollama is local — key optional (server URL is configured via OLLAMA_URL env)
    key_optional = payload.provider == "ollama"

    # If provider is not default/env-configured, require user API key
    if not key_optional and not has_env and not api_key_to_save and not user_keys.get(payload.provider):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"API key is required for {provider_label}.",
        )

    if api_key_to_save and not is_default:
        user_keys[payload.provider] = api_key_to_save

    from app.repositories.users import get_user_by_id, update_user_profile as update_profile_in_db
    user_record = get_user_by_id(database, user["uid"]) or {}
    is_subscribed = bool(user_record.get("is_subscribed") or user_record.get("subscription_plan"))
    existing_assistant = user_record.get("assistant_name") or (current_pref or {}).get("assistant_name")

    if payload.assistant_name and existing_assistant and payload.assistant_name.strip().lower() != existing_assistant.strip().lower():
        if not is_subscribed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Renaming your AI companion is a subscription feature. Upgrade your plan to rename your AI assistant.",
            )

    update_payload = {
        "provider": payload.provider,
        "model": payload.model,
        "api_keys": user_keys,
        "updated_at": SERVER_TIMESTAMP,
    }
    if payload.assistant_name:
        clean_assistant = payload.assistant_name.strip()
        update_payload["assistant_name"] = clean_assistant
        update_profile_in_db(database, user["uid"], display_name=user_record.get("display_name") or "User", assistant_name=clean_assistant)

    reference = _reference(database, user["uid"])
    reference.set(update_payload, merge=True)
    # Invalidate cached AI config so next chat uses new provider/model
    try:
        invalidate_ai_config_cache(user["uid"])
    except Exception:
        pass
    _invalidate_ai_models(user["uid"])

    default_model = AI_PROVIDERS.get(DEFAULT_PROVIDER, {}).get("default_model", settings.openai_model)
    return {
        "providers": await provider_catalog(user_keys),
        "preference": {
            "provider": payload.provider,
            "model": payload.model,
            "has_api_key": bool(user_keys.get(payload.provider)),
            "assistant_name": payload.assistant_name or (current_pref.get("assistant_name") if current_pref else "Eve") or "Eve",
        },
        "default_provider": DEFAULT_PROVIDER,
        "default_model": default_model,
    }
