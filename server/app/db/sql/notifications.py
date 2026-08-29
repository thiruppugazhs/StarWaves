"""SQL handlers for the 'users/{user_id}/notifications' collection."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import Notification

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


_NOTIFICATION_COLUMN_ALIASES = {"message": "body", "time": "notification_time"}


def notification_to_dict(n: Notification) -> dict[str, Any]:
    """Serialize Notification model to snapshot dictionary."""
    return {
        "id": n.id,
        "title": n.title,
        "body": n.body,
        "message": n.body,
        "type": n.type,
        "time": n.notification_time or "",
        "unread": not n.read,
        "read": n.read,
        "data": n.data or {},
        "deleted": n.deleted,
        "created_at": n.created_at.isoformat() if n.created_at else "",
        "updated_at": n.updated_at.isoformat() if n.updated_at else "",
    }


def get_notification_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch notification document by user ID and document ID."""
    n = session.get(Notification, doc_id)
    if not n or n.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, notification_to_dict(n))


def set_notification_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a notification document."""
    n = session.get(Notification, doc_id)
    if not n:
        n = Notification(
            id=doc_id,
            user_id=user_id,
            title=data.get("title", ""),
            body=data.get("body") or data.get("message", ""),
            type=data.get("type", "system"),
            read=data.get("read") if "read" in data else not bool(data.get("unread", True)),
            data=data.get("data") or {},
            notification_time=data.get("time"),
        )
        session.add(n)
    else:
        if n.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"title", "body", "message", "type", "read", "unread", "data", "notification_time", "time"}
        _IMMUTABLE = {"id", "user_id", "created_at"}
        for key, val in data.items():
            if key in {"deleted", "deleted_at"}:
                if hasattr(n, key):
                    setattr(n, key, coerce_model_value(key, val))
                continue
            if key in _IMMUTABLE:
                continue
            column = _NOTIFICATION_COLUMN_ALIASES.get(key, key)
            if column in _IMMUTABLE or column not in {"title", "body", "type", "read", "data", "notification_time"}:
                continue
            if hasattr(n, column):
                setattr(n, column, coerce_model_value(column, val))
    session.commit()


def delete_notification_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete a notification document by ID."""
    n = session.get(Notification, doc_id)
    if not n:
        return
    if user_id is not None and n.user_id != user_id:
        return
    session.delete(n)
    session.commit()


def query_notifications(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's notifications collection."""
    stmt = select(Notification).where(Notification.user_id == user_id)
    has_deleted_filter = any(f[0] == "deleted" for f in query.filters)
    if not has_deleted_filter:
        stmt = stmt.where(Notification.deleted == False)  # noqa: E712
    for field, op, val in query.filters:
        if field == "unread" and op in ("==", "="):
            stmt = stmt.where(Notification.read != val)
        elif field == "read" and op in ("==", "="):
            stmt = stmt.where(Notification.read == val)
        elif field == "deleted" and op in ("==", "="):
            stmt = stmt.where(Notification.deleted == val) if val else stmt.where(Notification.deleted == False)  # noqa: E712
    if query._start_after_doc_id:
        cursor = session.get(Notification, query._start_after_doc_id)
        if cursor and cursor.created_at:
            if query._direction == "DESC":
                stmt = stmt.where(Notification.created_at < cursor.created_at)
            else:
                stmt = stmt.where(Notification.created_at > cursor.created_at)
    if query._order_by == "created_at":
        stmt = stmt.order_by(Notification.created_at.desc() if query._direction == "DESC" else Notification.created_at.asc())
        stmt = stmt.order_by(Notification.id.desc() if query._direction == "DESC" else Notification.id.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    notifs = session.scalars(stmt).all()
    return [SqlSnapshot(n.id, notification_to_dict(n)) for n in notifs]
