"""SQL handlers for the 'users/{user_id}/contacts' collection."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import Contact

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def contact_to_dict(c: Contact) -> dict[str, Any]:
    """Serialize Contact model to snapshot dictionary."""
    return {
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "company": c.company,
        "role": c.role,
        "notes": c.notes,
        "deleted": c.deleted,
        "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else "",
        "updated_at": c.updated_at.isoformat() if c.updated_at else "",
    }


def get_contact_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch contact document by user ID and document ID."""
    c = session.get(Contact, doc_id)
    if not c or c.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, contact_to_dict(c))


def set_contact_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a contact document."""
    c = session.get(Contact, doc_id)
    if not c:
        c = Contact(
            id=doc_id,
            user_id=user_id,
            name=data.get("name", ""),
            email=data.get("email"),
            phone=data.get("phone"),
            company=data.get("company"),
            role=data.get("role"),
            notes=data.get("notes"),
        )
        session.add(c)
    else:
        if c.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"name", "email", "phone", "company", "role", "notes"}
        _IMMUTABLE = {"id", "user_id", "created_at"}
        for k, val in data.items():
            if k in {"deleted", "deleted_at"}:
                if hasattr(c, k):
                    setattr(c, k, coerce_model_value(k, val))
                continue
            if k in _IMMUTABLE:
                continue
            if k not in _ALLOWED:
                continue
            if hasattr(c, k):
                setattr(c, k, coerce_model_value(k, val))
    session.commit()


def delete_contact_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete a contact document by ID."""
    c = session.get(Contact, doc_id)
    if not c:
        return
    if user_id is not None and c.user_id != user_id:
        return
    session.delete(c)
    session.commit()


def query_contacts(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's contacts collection."""
    stmt = select(Contact).where(Contact.user_id == user_id)
    has_deleted_filter = any(f[0] == "deleted" for f in query.filters)
    if not has_deleted_filter:
        stmt = stmt.where(Contact.deleted == False)  # noqa: E712
    for field, op, val in query.filters:
        if field == "deleted" and op in ("==", "="):
            stmt = stmt.where(Contact.deleted == val) if val else stmt.where(Contact.deleted == False)  # noqa: E712
    if query._start_after_doc_id:
        cursor = session.get(Contact, query._start_after_doc_id)
        if cursor and cursor.created_at:
            if query._direction == "DESC":
                stmt = stmt.where(
                    or_(
                        Contact.created_at < cursor.created_at,
                        and_(Contact.created_at == cursor.created_at, Contact.id < cursor.id),
                    )
                )
            else:
                stmt = stmt.where(
                    or_(
                        Contact.created_at > cursor.created_at,
                        and_(Contact.created_at == cursor.created_at, Contact.id > cursor.id),
                    )
                )
    if query._order_by == "created_at":
        stmt = stmt.order_by(Contact.created_at.desc() if query._direction == "DESC" else Contact.created_at.asc())
        stmt = stmt.order_by(Contact.id.desc() if query._direction == "DESC" else Contact.id.asc())
    elif query._order_by == "name":
        stmt = stmt.order_by(Contact.name.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    contacts = session.scalars(stmt).all()
    return [SqlSnapshot(c.id, contact_to_dict(c)) for c in contacts]
