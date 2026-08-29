"""SQL handlers for the 'users/{user_id}/todos' collection."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import Todo

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def todo_to_dict(t: Todo) -> dict[str, Any]:
    """Serialize Todo model to snapshot dictionary."""
    return {
        "id": t.id,
        "title": t.title,
        "completed": t.completed,
        "due_date": t.due_date,
        "priority": t.priority,
        "deleted": t.deleted,
        "deleted_at": t.deleted_at.isoformat() if t.deleted_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else "",
        "updated_at": t.updated_at.isoformat() if t.updated_at else "",
    }


def get_todo_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch todo document by user ID and document ID."""
    t = session.get(Todo, doc_id)
    if not t or t.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, todo_to_dict(t))


def set_todo_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a todo document."""
    t = session.get(Todo, doc_id)
    if not t:
        t = Todo(
            id=doc_id,
            user_id=user_id,
            title=data.get("title", ""),
            completed=bool(data.get("completed", False)),
            due_date=data.get("due_date"),
            priority=data.get("priority", "medium"),
        )
        session.add(t)
    else:
        if t.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"title", "completed", "due_date", "priority"}
        _TIMESTAMP_FIELDS = {"created_at", "updated_at"}
        _IMMUTABLE = {"id", "user_id"}
        for k, val in data.items():
            if k in {"deleted", "deleted_at"}:
                if hasattr(t, k):
                    setattr(t, k, coerce_model_value(k, val))
                continue
            if k in _IMMUTABLE:
                continue
            if k in _TIMESTAMP_FIELDS:
                if hasattr(t, k):
                    setattr(t, k, coerce_model_value(k, val))
                continue
            if k not in _ALLOWED:
                continue
            if hasattr(t, k):
                setattr(t, k, coerce_model_value(k, val))
    session.commit()


def delete_todo_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete a todo document by ID."""
    t = session.get(Todo, doc_id)
    if not t:
        return
    if user_id is not None and t.user_id != user_id:
        return
    session.delete(t)
    session.commit()


def query_todos(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's todos collection."""
    stmt = select(Todo).where(Todo.user_id == user_id)
    # Server-side deleted filter
    has_deleted_filter = any(f[0] == "deleted" for f in query.filters)
    if not has_deleted_filter:
        stmt = stmt.where(Todo.deleted == False)  # noqa: E712
    for field, op, val in query.filters:
        if field == "deleted" and op in ("==", "="):
            stmt = stmt.where(Todo.deleted == val) if val else stmt.where(Todo.deleted == False)  # noqa: E712
        elif field == "completed" and op in ("==", "="):
            stmt = stmt.where(Todo.completed == val)
    # Keyset pagination: start_after cursor id -> filter by (created_at, id) for stable pagination
    if query._start_after_doc_id:
        cursor = session.get(Todo, query._start_after_doc_id)
        if cursor and cursor.created_at:
            if query._order_by == "created_at" and query._direction == "DESC":
                stmt = stmt.where(
                    or_(
                        Todo.created_at < cursor.created_at,
                        and_(Todo.created_at == cursor.created_at, Todo.id < cursor.id),
                    )
                )
            elif query._order_by == "created_at":
                stmt = stmt.where(
                    or_(
                        Todo.created_at > cursor.created_at,
                        and_(Todo.created_at == cursor.created_at, Todo.id > cursor.id),
                    )
                )
    if query._order_by == "created_at":
        if query._direction == "DESC":
            stmt = stmt.order_by(Todo.created_at.desc(), Todo.id.desc())
        else:
            stmt = stmt.order_by(Todo.created_at.asc(), Todo.id.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    todos = session.scalars(stmt).all()
    return [SqlSnapshot(t.id, todo_to_dict(t)) for t in todos]
