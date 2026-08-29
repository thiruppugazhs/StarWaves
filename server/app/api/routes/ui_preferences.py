"""UI preferences routes — single responsibility: per-user UI overrides CRUD."""

from fastapi import APIRouter

from app.core.cache import CACHE_TTL_LONG, cache_invalidate_prefix, cached
from app.core.dependencies import CurrentUserId, DbClient
from app.core.errors import bad_request
from app.schemas.ui import (
    UiHistoryResponse,
    UiPreferencesResponse,
    UiResetRequest,
    UiRestoreRequest,
    UiUpdateCssRequest,
    UiUpdateTokensRequest,
    UiVisibilityRequest,
)
from app.services.eve.constants import WORKSPACE_PAGES
from app.services.ui_preferences import (
    clear_all,
    get_ui_preferences,
    reset_preferences,
    save_css,
    save_tokens,
    save_visibility,
)

router = APIRouter(prefix="/ui/preferences")

_UI_PREFS_PREFIX = "ui:preferences"


def _invalidate_ui_prefs(user_id: str) -> None:
    cache_invalidate_prefix(f"{_UI_PREFS_PREFIX}:{user_id}")


@router.get("", response_model=UiPreferencesResponse)
@cached(ttl=CACHE_TTL_LONG, prefix=_UI_PREFS_PREFIX)
def get_preferences(db: DbClient, user_id: CurrentUserId):
    prefs = get_ui_preferences(db, user_id)
    return {"preferences": prefs, "available_pages": list(WORKSPACE_PAGES)}


@router.get("/history", response_model=UiHistoryResponse)
@cached(ttl=CACHE_TTL_LONG, prefix=f"{_UI_PREFS_PREFIX}:history")
def get_history(db: DbClient, user_id: CurrentUserId):
    prefs = get_ui_preferences(db, user_id)
    return {"history": prefs.get("history", []), "current_version": prefs.get("version", 1)}


@router.put("/tokens", response_model=UiPreferencesResponse)
def put_tokens(payload: UiUpdateTokensRequest, db: DbClient, user_id: CurrentUserId):
    try:
        prefs = save_tokens(db, user_id, payload.tokens, payload.page, payload.reason)
    except ValueError as exc:
        raise bad_request(str(exc))
    _invalidate_ui_prefs(user_id)
    return {"preferences": prefs, "available_pages": list(WORKSPACE_PAGES)}


@router.put("/css", response_model=UiPreferencesResponse)
def put_css(payload: UiUpdateCssRequest, db: DbClient, user_id: CurrentUserId):
    try:
        prefs = save_css(db, user_id, payload.css, payload.page)
    except ValueError as exc:
        raise bad_request(str(exc))
    _invalidate_ui_prefs(user_id)
    return {"preferences": prefs, "available_pages": list(WORKSPACE_PAGES)}


@router.put("/visibility", response_model=UiPreferencesResponse)
def put_visibility(payload: UiVisibilityRequest, db: DbClient, user_id: CurrentUserId):
    try:
        prefs = save_visibility(db, user_id, payload.target, payload.visible, payload.page)
    except ValueError as exc:
        raise bad_request(str(exc))
    _invalidate_ui_prefs(user_id)
    return {"preferences": prefs, "available_pages": list(WORKSPACE_PAGES)}


@router.post("/reset", response_model=UiPreferencesResponse)
def post_reset(payload: UiResetRequest, db: DbClient, user_id: CurrentUserId):
    try:
        prefs = reset_preferences(db, user_id, payload.page, payload.version)
    except ValueError as exc:
        raise bad_request(str(exc))
    _invalidate_ui_prefs(user_id)
    return {"preferences": prefs, "available_pages": list(WORKSPACE_PAGES)}


@router.post("/restore", response_model=UiPreferencesResponse)
def post_restore(payload: UiRestoreRequest, db: DbClient, user_id: CurrentUserId):
    try:
        prefs = reset_preferences(db, user_id, None, payload.version)
    except ValueError as exc:
        raise bad_request(str(exc))
    _invalidate_ui_prefs(user_id)
    return {"preferences": prefs, "available_pages": list(WORKSPACE_PAGES)}


@router.delete("", response_model=UiPreferencesResponse)
def delete_preferences(db: DbClient, user_id: CurrentUserId):
    prefs = clear_all(db, user_id)
    _invalidate_ui_prefs(user_id)
    return {"preferences": prefs, "available_pages": list(WORKSPACE_PAGES)}
