"""SQL handlers for the 'users/{user_id}/hackathons' collection."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import Hackathon

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def hackathon_to_dict(h: Hackathon) -> dict[str, Any]:
    """Serialize Hackathon model to snapshot dictionary (schema-shaped fields included)."""
    return {
        "id": h.id,
        "title": h.title,
        "organizer": h.organizer,
        "location": h.location,
        "dates": h.dates,
        "prize": h.prize,
        "status": h.status,
        "hackathon_url": h.hackathon_url,
        "url": h.hackathon_url or "",
        "source": h.source or "",
        "notes": h.notes,
        "starts_at": h.starts_at.isoformat() if h.starts_at else None,
        "ends_at": h.ends_at.isoformat() if h.ends_at else None,
        "mode": h.mode or "online",
        "team_size": h.team_size or "",
        "tags": h.tags or [],
        "deleted": h.deleted,
        "deleted_at": h.deleted_at.isoformat() if h.deleted_at else None,
        "created_at": h.created_at.isoformat() if h.created_at else "",
        "updated_at": h.updated_at.isoformat() if h.updated_at else "",
    }


_HACKATHON_COLUMN_ALIASES = {"url": "hackathon_url"}


def get_hackathon_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch hackathon document by user ID and document ID."""
    h = session.get(Hackathon, doc_id)
    if not h or h.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, hackathon_to_dict(h))


def set_hackathon_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a hackathon document."""
    h = session.get(Hackathon, doc_id)
    if not h:
        h = Hackathon(
            id=doc_id,
            user_id=user_id,
            title=data.get("title", ""),
            organizer=data.get("organizer"),
            location=data.get("location"),
            dates=data.get("dates"),
            prize=data.get("prize"),
            status=data.get("status", "Registered"),
            source=data.get("source"),
            notes=data.get("notes"),
            starts_at=coerce_model_value("starts_at", data.get("starts_at")),
            ends_at=coerce_model_value("ends_at", data.get("ends_at")),
        )
        session.add(h)
    else:
        if h.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"title", "organizer", "location", "dates", "prize", "status", "hackathon_url", "url", "source", "notes", "starts_at", "ends_at", "mode", "team_size", "tags"}
        _IMMUTABLE = {"id", "user_id", "created_at"}
        for key, val in data.items():
            if key in {"deleted", "deleted_at"}:
                if hasattr(h, key):
                    setattr(h, key, coerce_model_value(key, val))
                continue
            if key in _IMMUTABLE:
                continue
            column = _HACKATHON_COLUMN_ALIASES.get(key, key)
            if column in _IMMUTABLE or column not in _ALLOWED:
                continue
            if hasattr(h, column):
                setattr(h, column, coerce_model_value(column, val))
    session.commit()


def delete_hackathon_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete a hackathon document by ID."""
    h = session.get(Hackathon, doc_id)
    if not h:
        return
    if user_id is not None and h.user_id != user_id:
        return
    session.delete(h)
    session.commit()


def query_hackathons(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's hackathons collection."""
    stmt = select(Hackathon).where(Hackathon.user_id == user_id)
    has_deleted_filter = any(f[0] == "deleted" for f in query.filters)
    if not has_deleted_filter:
        stmt = stmt.where(Hackathon.deleted == False)  # noqa: E712
    for field, op, val in query.filters:
        if field == "deleted" and op in ("==", "="):
            stmt = stmt.where(Hackathon.deleted == val) if val else stmt.where(Hackathon.deleted == False)  # noqa: E712
    if query._start_after_doc_id:
        cursor = session.get(Hackathon, query._start_after_doc_id)
        if cursor and cursor.created_at:
            if query._direction == "DESC":
                stmt = stmt.where(Hackathon.created_at < cursor.created_at)
            else:
                stmt = stmt.where(Hackathon.created_at > cursor.created_at)
    if query._order_by == "created_at":
        stmt = stmt.order_by(Hackathon.created_at.desc() if query._direction == "DESC" else Hackathon.created_at.asc())
        stmt = stmt.order_by(Hackathon.id.desc() if query._direction == "DESC" else Hackathon.id.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    hackathons = session.scalars(stmt).all()
    return [SqlSnapshot(h.id, hackathon_to_dict(h)) for h in hackathons]
