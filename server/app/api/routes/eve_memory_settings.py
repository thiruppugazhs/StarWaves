from fastapi import APIRouter, Depends
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_LONG, cache_invalidate_prefix, cached
from app.schemas.eve import EveMemorySettingsResponse, EveMemorySettingsUpdate
from app.services.eve.memory_settings import (
    EVE_MEMORY_SETTINGS_DOC,
    resolve_auto_remember,
)

router = APIRouter(prefix="/settings/eve-memory")

_EVE_MEMORY_SETTINGS_PREFIX = "settings:eve-memory"


def _invalidate_eve_memory_settings(user_id: str) -> None:
    cache_invalidate_prefix(f"{_EVE_MEMORY_SETTINGS_PREFIX}:{user_id}")


def _reference(database: SqlClient, user_id: str):
    return (
        database.collection("users")
        .document(user_id)
        .collection("settings")
        .document(EVE_MEMORY_SETTINGS_DOC)
    )


@router.get("", response_model=EveMemorySettingsResponse)
@cached(ttl=CACHE_TTL_LONG, prefix=_EVE_MEMORY_SETTINGS_PREFIX)
def get_eve_memory_settings(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    return {"auto_remember": resolve_auto_remember(database, user["uid"])}


@router.put("", response_model=EveMemorySettingsResponse)
def save_eve_memory_settings(
    payload: EveMemorySettingsUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    reference = _reference(database, user["uid"])
    reference.set(
        {
            "auto_remember": payload.auto_remember,
            "updated_at": SERVER_TIMESTAMP,
        },
        merge=True,
    )
    _invalidate_eve_memory_settings(user["uid"])
    return {"auto_remember": payload.auto_remember}
