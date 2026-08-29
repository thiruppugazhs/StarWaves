from fastapi import APIRouter, Depends, HTTPException, status
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_LONG, cache_invalidate_prefix, cached
from app.schemas.eve_speech import (
    EveSpeechPreferenceUpdate,
    EveSpeechResponse,
)
from app.services.speech import (
    SPEECH_SETTINGS_DOC,
    load_speech_preference,
    stt_catalog,
    tts_catalog,
    validate_speech_preference,
)

router = APIRouter(prefix="/settings/eve-speech")

_EVE_SPEECH_PREFIX = "settings:eve-speech"


def _invalidate_eve_speech(user_id: str) -> None:
    cache_invalidate_prefix(f"{_EVE_SPEECH_PREFIX}:{user_id}")


def _reference(database: SqlClient, user_id: str):
    return (
        database.collection("users")
        .document(user_id)
        .collection("settings")
        .document(SPEECH_SETTINGS_DOC)
    )


def _preference_payload(database: SqlClient, user_id: str) -> dict | None:
    preference = load_speech_preference(database, user_id)
    if not preference:
        return None
    return {
        "stt_provider": preference.get("stt_provider") or "browser",
        "stt_model": preference.get("stt_model") or "",
        "tts_provider": preference.get("tts_provider") or "browser",
        "tts_voice": preference.get("tts_voice") or "",
    }


@router.get("", response_model=EveSpeechResponse)
@cached(ttl=CACHE_TTL_LONG, prefix=_EVE_SPEECH_PREFIX)
def get_eve_speech(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    return {
        "stt_providers": stt_catalog(),
        "tts_providers": tts_catalog(),
        "preference": _preference_payload(database, user["uid"]),
    }


@router.put("", response_model=EveSpeechResponse)
def save_eve_speech(
    payload: EveSpeechPreferenceUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    if not validate_speech_preference(
        stt_provider=payload.stt_provider,
        stt_model=payload.stt_model,
        tts_provider=payload.tts_provider,
        tts_voice=payload.tts_voice,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unknown speech provider, model, or voice.",
        )
    reference = _reference(database, user["uid"])
    reference.set(
        {
            "stt_provider": payload.stt_provider,
            "stt_model": payload.stt_model,
            "tts_provider": payload.tts_provider,
            "tts_voice": payload.tts_voice,
            "updated_at": SERVER_TIMESTAMP,
        },
        merge=True,
    )
    _invalidate_eve_speech(user["uid"])
    return {
        "stt_providers": stt_catalog(),
        "tts_providers": tts_catalog(),
        "preference": {
            "stt_provider": payload.stt_provider,
            "stt_model": payload.stt_model,
            "tts_provider": payload.tts_provider,
            "tts_voice": payload.tts_voice,
        },
    }
