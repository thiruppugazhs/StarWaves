"""Device session management — list, rename, revoke for multi-device."""

import asyncio
from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel

from app.core.auth import _validate_token_payload
from app.core.cache import cache_invalidate_prefix
from app.core.dependencies import CurrentUser
from app.core.errors import bad_request, not_found
from app.db.session import sync_engine
from sqlalchemy import text

router = APIRouter(prefix="/auth/sessions", tags=["auth"])


def _current_jti(authorization: str | None = Header(default=None)) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    data = _validate_token_payload(token)
    if data and isinstance(data.get("jti"), str):
        return data["jti"]
    return None


@router.get("", response_model=dict)
async def list_sessions(
    user: CurrentUser,
    request: Request,
    authorization: str | None = Header(default=None),
):
    jti = _current_jti(authorization)
    def _fetch():
        from app.db.sql.user_sessions import list_user_sessions

        from sqlalchemy.orm import Session

        with Session(sync_engine) as s:
            rows = list_user_sessions(s, user["uid"])
            for r in rows:
                r["is_current"] = bool(jti and r.get("token_jti") == jti)
            return rows

    sessions = await asyncio.to_thread(_fetch)
    # touch current handled in auth validation already
    return {"sessions": sessions, "current_jti": jti}


@router.patch("/{session_id}", response_model=dict)
async def rename_session(
    session_id: str,
    payload: dict,
    user: CurrentUser,
):
    name = str(payload.get("device_name") or "").strip()
    if not name or len(name) > 255:
        raise bad_request("Device name must be 1-255 characters.")
    if "<" in name or ">" in name or "javascript:" in name.lower():
        raise bad_request("Invalid device name.")
    def _do():
        from app.db.sql.user_sessions import update_session_name

        from sqlalchemy.orm import Session

        with Session(sync_engine) as s:
            return update_session_name(s, user["uid"], session_id, name)

    ok = await asyncio.to_thread(_do)
    if not ok:
        raise not_found("Session not found.")
    cache_invalidate_prefix("session_revoked:")
    return {"ok": True}


@router.delete("/{session_id}", response_model=dict)
async def revoke_session(
    session_id: str,
    user: CurrentUser,
    authorization: str | None = Header(default=None),
):
    jti = _current_jti(authorization)
    def _do():
        from app.db.sql.user_sessions import get_user_session, revoke_session as do_revoke

        from sqlalchemy.orm import Session

        with Session(sync_engine) as s:
            row = get_user_session(s, user["uid"], session_id)
            if not row:
                return None
            # prevent self-revoke via this endpoint if it's current — ask to use logout
            if jti and row.token_jti == jti:
                return "self"
            ok = do_revoke(s, user["uid"], session_id)
            return row.token_jti if ok else None

    res = await asyncio.to_thread(_do)
    if res is None:
        raise not_found("Session not found.")
    if res == "self":
        raise bad_request("Cannot revoke current session via this endpoint. Use logout.")
    cache_invalidate_prefix("session_revoked:")
    # Notify other devices via WS — best effort
    try:
        from app.core.whatsapp_ws_manager import whatsapp_ws_manager

        await whatsapp_ws_manager.broadcast_to_user(user["uid"], {"type": "session_revoked", "jti": res})
    except Exception:
        pass
    return {"ok": True, "revoked_jti": res}


@router.post("/revoke-others", response_model=dict)
async def revoke_others(
    user: CurrentUser,
    authorization: str | None = Header(default=None),
):
    jti = _current_jti(authorization)
    if not jti:
        raise bad_request("Current session has no jti — please re-login.")
    def _do():
        from app.db.sql.user_sessions import revoke_other_sessions

        from sqlalchemy.orm import Session

        with Session(sync_engine) as s:
            return revoke_other_sessions(s, user["uid"], jti)

    count = await asyncio.to_thread(_do)
    cache_invalidate_prefix("session_revoked:")
    if count:
        try:
            from app.core.whatsapp_ws_manager import whatsapp_ws_manager

            await whatsapp_ws_manager.broadcast_to_user(user["uid"], {"type": "sessions_revoked_others", "keep_jti": jti})
        except Exception:
            pass
    return {"revoked_count": count}
