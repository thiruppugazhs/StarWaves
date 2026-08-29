"""Unified live model catalog — one endpoint to list every provider's models.

GET /api/v1/models            — aggregated live models from all configured providers
GET /api/v1/models/{provider} — live models for a single provider (richer than /settings/ai-models/models/{provider})
Query: ?free_only=true        — only models with pricing 0 (e.g. fish-audio/s2.1-pro-free:free)
       ?modalities=speech     — filter by output modality (text|speech|image)
"""

from fastapi import APIRouter, Depends, Query
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.services.ai_models.config import has_server_key
from app.services.ai_models.unified import discover_all_models

router = APIRouter(prefix="/models")


def _user_keys_from_db(database: SqlClient, user_uid: str) -> dict[str, str]:
    try:
        from app.services.ai_models.config import load_ai_preference
        pref = load_ai_preference(database, user_uid)
        if not pref:
            return {}
        keys: dict[str, str] = {}
        saved = pref.get("api_keys")
        if isinstance(saved, dict):
            keys.update({k: str(v) for k, v in saved.items() if v})
        legacy = pref.get("api_key")
        prov = pref.get("provider")
        if legacy and prov and prov not in keys:
            keys[prov] = str(legacy)
        return keys
    except Exception:
        return {}


@router.get("")
async def list_unified_models(
    free_only: bool = Query(default=False, description="Only free (pricing 0) models"),
    modalities: str | None = Query(default=None, description="Filter output_modalities: text|speech|image"),
    tts: bool | None = Query(default=None),
    stt: bool | None = Query(default=None),
    provider: str | None = Query(default=None, description="Limit to one provider"),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    user_keys = _user_keys_from_db(database, user["uid"])
    # Also include server keys implicitly via discover_all_models (effective_api_key)
    models = await discover_all_models(user_keys, include_free_only=free_only)

    if provider:
        models = [m for m in models if m["provider"] == provider]
    if modalities:
        want = modalities.lower()
        models = [m for m in models if want in [str(x).lower() for x in m.get("output_modalities", [])]]
    if tts is not None:
        models = [m for m in models if bool(m.get("supports_tts")) == tts]
    if stt is not None:
        models = [m for m in models if bool(m.get("supports_stt")) == stt]

    # Strip raw to keep payload small unless requested? Keep is useful but trim.
    for m in models:
        # Keep only small raw excerpt
        raw = m.get("raw") or {}
        if len(str(raw)) > 400:
            m["raw"] = {"truncated": True}

    return {
        "count": len(models),
        "models": models,
        "available_providers": [p for p in ["openai", "anthropic", "gemini", "openrouter", "groq", "ollama", "opencode"] if has_server_key(p) or p in user_keys],
    }


@router.get("/{provider}")
async def list_provider_unified(
    provider: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    user_keys = _user_keys_from_db(database, user["uid"])
    models = await discover_all_models(user_keys, include_free_only=False)
    filtered = [m for m in models if m["provider"] == provider]
    return {"provider": provider, "count": len(filtered), "models": filtered}
