"""SQL handlers for the 'users/{user_id}/documents' collection."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import Document

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def document_to_dict(d: Document) -> dict[str, Any]:
    """Serialize Document model to snapshot dictionary (schema-shaped fields included)."""
    return {
        "id": d.id,
        "title": d.title,
        "name": d.title or "Untitled",
        "content": d.content,
        "description": d.content or "",
        "folder": d.folder,
        "category": d.folder or "General",
        "url": d.url or "",
        "doc_type": d.doc_type or "FILE",
        "type": d.doc_type or "FILE",
        "size_label": d.size_label or "Unknown",
        "size": d.size_label or "Unknown",
        "drive_file_id": d.drive_file_id,
        "tags": d.tags or [],
        "deleted": d.deleted,
        "deleted_at": d.deleted_at.isoformat() if d.deleted_at else None,
        "created_at": d.created_at.isoformat() if d.created_at else "",
        "updated_at": d.updated_at.isoformat() if d.updated_at else "",
        "modified_at": d.updated_at.isoformat() if d.updated_at else "",
    }


def _apply_document_data(d: Document, data: dict[str, Any], *, is_create: bool = False) -> None:
    """Map schema-shaped and legacy Firestore-shaped keys onto model columns."""
    # Client-controlled allowlist (exclude deleted lifecycle markers unless via internal)
    mapping = {
        "title": "title",
        "name": "title",
        "content": "content",
        "description": "content",
        "folder": "folder",
        "category": "folder",
        "tags": "tags",
        "url": "url",
        "type": "doc_type",
        "doc_type": "doc_type",
        "size": "size_label",
        "size_label": "size_label",
        "drive_file_id": "drive_file_id",
    }
    # Only internal helpers may set deleted markers; normal API data should not
    if is_create:
        # for create, mapping already limited
        pass
    for key, value in data.items():
        if key in {"deleted", "deleted_at"}:
            if hasattr(d, key):
                setattr(d, key, coerce_model_value(key, value))
            continue
        column = mapping.get(key)
        if column is not None:
            setattr(d, column, coerce_model_value(column, value))


def get_document_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch document by user ID and document ID."""
    d = session.get(Document, doc_id)
    if not d or d.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, document_to_dict(d))


def set_document_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a document record."""
    d = session.get(Document, doc_id)
    if not d:
        d = Document(
            id=doc_id,
            user_id=user_id,
            title="",
            content="",
            folder="General",
            tags=[],
        )
        session.add(d)
        _apply_document_data(d, data, is_create=True)
    else:
        if d.user_id != user_id:
            raise PermissionError("Not owner")
        _apply_document_data(d, data, is_create=False)
    session.commit()


def delete_document_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete a document record by ID."""
    d = session.get(Document, doc_id)
    if not d:
        return
    if user_id is not None and d.user_id != user_id:
        return
    session.delete(d)
    session.commit()


def query_documents(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's documents collection."""
    stmt = select(Document).where(Document.user_id == user_id)
    has_deleted_filter = any(f[0] == "deleted" for f in query.filters)
    if not has_deleted_filter:
        stmt = stmt.where(Document.deleted == False)  # noqa: E712
    for field, op, val in query.filters:
        if field == "deleted" and op in ("==", "="):
            stmt = stmt.where(Document.deleted == val) if val else stmt.where(Document.deleted == False)  # noqa: E712
    if query._start_after_doc_id:
        cursor = session.get(Document, query._start_after_doc_id)
        if cursor:
            ts = cursor.updated_at or cursor.created_at
            if ts:
                if query._order_by == "modified_at" and query._direction == "DESC":
                    stmt = stmt.where(
                        or_(
                            Document.updated_at < ts,
                            and_(Document.updated_at == ts, Document.id < cursor.id),
                        )
                    )
                elif query._order_by == "modified_at":
                    stmt = stmt.where(
                        or_(
                            Document.updated_at > ts,
                            and_(Document.updated_at == ts, Document.id > cursor.id),
                        )
                    )
                elif query._direction == "DESC":
                    stmt = stmt.where(
                        or_(
                            Document.created_at < cursor.created_at,
                            and_(Document.created_at == cursor.created_at, Document.id < cursor.id),
                        )
                    )
                else:
                    stmt = stmt.where(
                        or_(
                            Document.created_at > cursor.created_at,
                            and_(Document.created_at == cursor.created_at, Document.id > cursor.id),
                        )
                    )
    if query._order_by == "created_at":
        stmt = stmt.order_by(Document.created_at.desc() if query._direction == "DESC" else Document.created_at.asc())
        stmt = stmt.order_by(Document.id.desc() if query._direction == "DESC" else Document.id.asc())
    elif query._order_by == "modified_at":
        stmt = stmt.order_by(Document.updated_at.desc() if query._direction == "DESC" else Document.updated_at.asc())
        stmt = stmt.order_by(Document.id.desc() if query._direction == "DESC" else Document.id.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    docs = session.scalars(stmt).all()
    return [SqlSnapshot(d.id, document_to_dict(d)) for d in docs]
