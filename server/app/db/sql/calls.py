"""SQL handlers for the 'calls' collection (WebRTC calls and Eve AI voice records)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import Call, User

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery

EVE_BOT_UID = "eve-bot"
EVE_BOT_IDENTITY = {"uid": EVE_BOT_UID, "name": "Eve AI Assistant", "email": "eve@starwaves.app"}


def call_participant_identity(session: Session, uid: str) -> dict[str, Any]:
    """Resolve caller or callee participant identity dictionary."""
    if uid == EVE_BOT_UID:
        return dict(EVE_BOT_IDENTITY)
    user = session.get(User, uid)
    if not user:
        return {"uid": uid, "name": uid, "email": ""}
    return {
        "uid": user.id,
        "name": user.name or user.display_name or (user.email or "").split("@")[0] or user.id,
        "email": user.email or "",
    }


def call_snapshot(call: Call, session: Session) -> dict[str, Any]:
    """Serialize Call model to full document snapshot dictionary."""
    return {
        "id": call.id,
        "caller": call_participant_identity(session, call.caller_id),
        "callee": call_participant_identity(session, call.receiver_id),
        "caller_id": call.caller_id,
        "receiver_id": call.receiver_id,
        "status": call.status,
        "call_type": call.call_type,
        "mode": call.call_type,
        "duration": call.duration,
        "messages": call.messages or [],
        "participants": [call.caller_id, call.receiver_id],
        "created_at": call.created_at.isoformat() if call.created_at else "",
        "updated_at": call.updated_at.isoformat() if call.updated_at else "",
    }


def get_call_doc(session: Session, doc_id: str) -> SqlSnapshot:
    """Fetch call document by ID."""
    c = session.get(Call, doc_id)
    if not c:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, call_snapshot(c, session))


def set_call_doc(
    session: Session,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a call document."""
    c = session.get(Call, doc_id)
    caller = data.get("caller") or {}
    callee = data.get("callee") or {}
    participants = data.get("participants") or []
    caller_id = caller.get("uid") or data.get("caller_id") or (participants[0] if len(participants) > 0 else "")
    receiver_id = callee.get("uid") or data.get("receiver_id") or (participants[1] if len(participants) > 1 else "")
    if not c:
        c = Call(
            id=doc_id,
            caller_id=caller_id,
            receiver_id=receiver_id,
            status=data.get("status", "ringing"),
            call_type=data.get("mode") or data.get("call_type", "voice"),
            duration=data.get("duration", 0),
            messages=data.get("messages") or [],
        )
        session.add(c)
    else:
        # Calls are not user-scoped via user_id; participants are checked at route level
        # Restrict mutable fields to prevent IDOR via caller/receiver hijack
        if "status" in data:
            c.status = data["status"]
        if "duration" in data:
            c.duration = data["duration"]
        if "messages" in data:
            c.messages = data["messages"] or []
        # Allow only safe fields via explicit allowlist (no caller_id/receiver_id rewrite)
        _ALLOWED_CALL = {"status", "duration", "messages", "provider", "external_sid", "phone_number"}
        for k, val in data.items():
            if k not in _ALLOWED_CALL:
                continue
            if hasattr(c, k):
                setattr(c, k, coerce_model_value(k, val))
    session.commit()


def delete_call_doc(session: Session, doc_id: str) -> None:
    """Delete a call document by ID."""
    c = session.get(Call, doc_id)
    if c:
        session.delete(c)
        session.commit()


def query_calls(session: Session, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the calls collection."""
    stmt = select(Call)
    for field, op, val in query.filters:
        if field == "status" and op in ("==", "="):
            stmt = stmt.where(Call.status == val)
        elif field in ("participants", "caller_id", "receiver_id") and op == "array_contains":
            stmt = stmt.where(or_(Call.caller_id == val, Call.receiver_id == val))
    if query._order_by in ("updated_at", "created_at"):
        stmt = stmt.order_by(Call.updated_at.desc() if query._direction == "DESC" else Call.updated_at.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    calls = session.scalars(stmt).all()
    return [SqlSnapshot(c.id, call_snapshot(c, session)) for c in calls]
