"""Call routes: create WebRTC calls and exchange signaling between users.

Signaling is WebSocket-push based. The server pushes events to connected
clients via ``call_ws_manager`` whenever a write occurs, so no polling
is required. The HTTP endpoints remain for REST semantics and for callers
that are not yet connected to the WebSocket.
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.cache import cache_invalidate_prefix, cached
from app.core.ws_manager import call_ws_manager
from app.repositories.calls import CallRepository
from app.repositories.users import get_user_by_email, get_user_by_id
from app.schemas.call import (
    CallCreate,
    CallResponse,
    CallStatusUpdate,
    CallUser,
    SignalCreate,
)
from app.services.notifications import send_call_notification

router = APIRouter(prefix="/calls")

_CALLS_PREFIX = "calls"

RECENT_CALL_LIMIT = 30


def _invalidate_calls(user_id: str) -> None:
    cache_invalidate_prefix(f"{_CALLS_PREFIX}:{user_id}")


EVE_BOT_USER = {"uid": "eve-bot", "email": "eve@starwaves.app", "display_name": "Eve AI Assistant"}


def _resolve_callee(database: SqlClient, identifier: str, current_user: dict) -> dict:
    cleaned = identifier.strip().lower()
    if cleaned in ("eve", "eve-bot", "eve@starwaves.app"):
        return EVE_BOT_USER
    record = get_user_by_email(database, cleaned) or get_user_by_id(database, cleaned)
    if not record:
        raise HTTPException(status_code=404, detail="User not found.")
    if record["uid"] == current_user["uid"]:
        raise HTTPException(status_code=400, detail="You cannot call yourself.")
    return record


def _person(record: dict) -> CallUser:
    name = record.get("display_name") or record.get("name") or record.get("email") or ""
    return CallUser(uid=record["uid"], name=name, email=record.get("email") or "")


def _require_participant(call: dict | None, uid: str) -> dict:
    if not call:
        raise HTTPException(status_code=404, detail="Call not found.")
    if uid not in call.get("participants", []):
        raise HTTPException(status_code=403, detail="You are not part of this call.")
    return call


def _serialize(call: dict) -> dict:
    call["messages"] = call.get("messages") or []
    return call


def _newest_incoming(repository: CallRepository, uid: str) -> dict | None:
    incoming = repository.list_incoming(uid, limit=1)
    return incoming[0] if incoming else None


@router.get("/incoming", response_model=list[CallResponse])
@cached(ttl=5, prefix=_CALLS_PREFIX)
async def list_incoming_calls(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = CallRepository(database)
    # Offload sync Firestore call to threadpool so single e2-micro worker stays responsive
    incoming = await asyncio.to_thread(repository.list_incoming, user["uid"])
    return [_serialize(call) for call in incoming]


@router.get("/recent", response_model=list[CallResponse])
@cached(ttl=5, prefix=_CALLS_PREFIX)
async def list_recent_calls(
    limit: int = Query(default=20, ge=1, le=RECENT_CALL_LIMIT),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = CallRepository(database)
    recent = await asyncio.to_thread(repository.list_recent, user["uid"], limit)
    return [_serialize(call) for call in recent]


@router.post(
    "/trigger-eve",
    response_model=CallResponse,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_eve_call(
    mode: str = Query(default="audio"),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = CallRepository(database)
    call = repository.create(
        caller=CallUser(uid=EVE_BOT_USER["uid"], name=EVE_BOT_USER["display_name"], email=EVE_BOT_USER["email"]),
        callee=_person(user),
        mode=mode,
    )
    send_call_notification(
        database=database,
        target_user_id=user["uid"],
        title="Incoming Eve Call",
        message="Incoming voice call from Eve AI Assistant",
        notification_type="call_incoming",
        call_id=call["id"],
    )
    serialized = _serialize(call)
    await call_ws_manager.send(user["uid"], {"type": "incoming_call", "call": serialized})
    _invalidate_calls(user["uid"])
    return serialized


@router.post(
    "",
    response_model=CallResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_call(
    payload: CallCreate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    callee_record = _resolve_callee(database, payload.callee_identifier, user)
    repository = CallRepository(database)
    call = repository.create(
        caller=_person(user),
        callee=_person(callee_record),
        mode=payload.mode,
    )
    if callee_record["uid"] == EVE_BOT_USER["uid"]:
        call = repository.update_status(call["id"], "active")
    else:
        send_call_notification(
            database=database,
            target_user_id=callee_record["uid"],
            title="Incoming Call",
            message=f"Incoming {payload.mode} call from {_person(user).name}",
            notification_type="call_incoming",
            call_id=call["id"],
        )
        serialized = _serialize(call)
        await call_ws_manager.send(
            callee_record["uid"], {"type": "incoming_call", "call": serialized}
        )
        _invalidate_calls(user["uid"])
        _invalidate_calls(callee_record["uid"])
        return serialized
    _invalidate_calls(user["uid"])
    _invalidate_calls(callee_record["uid"])
    return _serialize(call)


@router.get("/{call_id}", response_model=CallResponse)
@cached(ttl=5, prefix=_CALLS_PREFIX)
async def get_call(
    call_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = CallRepository(database)
    call = await asyncio.to_thread(repository.get, call_id)
    call = _require_participant(call, user["uid"])
    return _serialize(call)


@router.patch("/{call_id}/status", response_model=CallResponse)
async def update_call_status(
    call_id: str,
    payload: CallStatusUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = CallRepository(database)
    _require_participant(repository.get(call_id), user["uid"])
    call = repository.update_status(call_id, payload.status)
    if payload.status == "missed":
        caller_name = call.get("caller", {}).get("name", "Someone")
        callee_uid = call.get("callee", {}).get("uid")
        if callee_uid:
            send_call_notification(
                database=database,
                target_user_id=callee_uid,
                title="Missed Call",
                message=f"Missed {call.get('mode', 'call')} from {caller_name}",
                notification_type="call_missed",
                call_id=call_id,
            )
    elif payload.status == "declined":
        callee_name = call.get("callee", {}).get("name", "User")
        caller_uid = call.get("caller", {}).get("uid")
        if caller_uid:
            send_call_notification(
                database=database,
                target_user_id=caller_uid,
                title="Call Declined",
                message=f"{callee_name} declined your call",
                notification_type="call_declined",
                call_id=call_id,
            )
    serialized = _serialize(call)
    # Push call_updated to both participants so each side reacts immediately.
    caller_uid = call.get("caller", {}).get("uid")
    callee_uid = call.get("callee", {}).get("uid")
    event = {"type": "call_updated", "call": serialized}
    for uid in {caller_uid, callee_uid} - {None}:
        await call_ws_manager.send(uid, event)
        _invalidate_calls(uid)
    return serialized


@router.post("/{call_id}/signals", response_model=CallResponse)
async def send_call_signal(
    call_id: str,
    payload: SignalCreate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = CallRepository(database)
    _require_participant(repository.get(call_id), user["uid"])
    repository.append_signal(call_id, user["uid"], payload.type, payload.payload)
    call = _serialize(repository.get(call_id))
    # Push the updated call document to the other participant so they receive
    # the new signal (offer / answer / ice-candidate) without polling.
    caller_uid = call.get("caller", {}).get("uid")
    callee_uid = call.get("callee", {}).get("uid")
    other_uid = callee_uid if user["uid"] == caller_uid else caller_uid
    if other_uid:
        await call_ws_manager.send(other_uid, {"type": "call_signal", "call": call})
    _invalidate_calls(user["uid"])
    if other_uid:
        _invalidate_calls(other_uid)
    return call