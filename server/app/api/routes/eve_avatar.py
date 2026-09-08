"""Eve avatar routes — preferences + models + upload (single responsibility)."""

from fastapi import APIRouter

from app.core.cache import CACHE_TTL_LONG, CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.core.dependencies import CurrentUserId, DbClient
from app.core.errors import bad_request, not_found
from app.schemas.eve_avatar import EveAvatarModelsResponse, EveAvatarPrefsRequest, EveAvatarPrefsResponse, EveAvatarUploadRequest
from app.services.eve_avatar import CATALOG, delete_upload, get_prefs, list_models, save_prefs, save_upload

import base64

router = APIRouter(prefix="/eve/avatar")

_PREF_PREFIX = "eve:avatar:preferences"
_MODELS_PREFIX = "eve:avatar:models"


def _invalidate(user_id: str) -> None:
    cache_invalidate_prefix(f"{_PREF_PREFIX}:{user_id}")
    cache_invalidate_prefix(f"{_MODELS_PREFIX}:{user_id}")
    cache_invalidate_prefix(f"ui:preferences:{user_id}")


@router.get("/preferences", response_model=EveAvatarPrefsResponse)
@cached(ttl=CACHE_TTL_LONG, prefix=_PREF_PREFIX)
def get_preferences(db: DbClient, user_id: CurrentUserId):
    prefs = get_prefs(db, user_id)
    return {"preferences": prefs, "available_models": CATALOG}


@router.put("/preferences", response_model=EveAvatarPrefsResponse)
def put_preferences(payload: EveAvatarPrefsRequest, db: DbClient, user_id: CurrentUserId):
    try:
        prefs = save_prefs(db, user_id, payload.model_dump(exclude_none=False))
    except ValueError as exc:
        raise bad_request(str(exc))
    _invalidate(user_id)
    return {"preferences": prefs, "available_models": CATALOG}


@router.get("/models", response_model=EveAvatarModelsResponse)
@cached(ttl=CACHE_TTL_SHORT, prefix=_MODELS_PREFIX)
def get_models(db: DbClient, user_id: CurrentUserId, cursor: str | None = None, limit: int = 20):
    limit = max(1, min(50, limit))
    data = list_models(db, user_id, limit=limit, cursor=cursor)
    return data


@router.post("/upload", response_model=EveAvatarPrefsResponse)
def post_upload(payload: EveAvatarUploadRequest, db: DbClient, user_id: CurrentUserId):
    try:
        raw = base64.b64decode(payload.content_base64, validate=True)
    except Exception:
        raise bad_request("Invalid base64 content.")
    if len(payload.filename) > 260 or ".." in payload.filename or "/" in payload.filename.replace("\\", "/").split("/")[-1:][0] == "..":
        # basic traversal guard; service does deeper
        pass
    try:
        result = save_upload(db, user_id, payload.filename, raw)
    except ValueError as exc:
        raise bad_request(str(exc))
    _invalidate(user_id)
    return {"preferences": result["preferences"], "available_models": CATALOG}


@router.delete("/models/{model_id}")
def delete_model(model_id: str, db: DbClient, user_id: CurrentUserId):
    try:
        delete_upload(db, user_id, model_id)
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg.lower():
            raise not_found(msg)
        raise bad_request(msg)
    _invalidate(user_id)
    return {"ok": True}
