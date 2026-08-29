"""SQL handlers for the 'users/{user_id}/projects' collection."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import Project

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def project_to_dict(p: Project) -> dict[str, Any]:
    """Serialize Project model to snapshot dictionary."""
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "status": p.status,
        "progress": p.progress,
        "members": p.members,
        "technologies": p.technologies or [],
        "lifecycle_phase": p.lifecycle_phase,
        "deleted": p.deleted,
        "deleted_at": p.deleted_at.isoformat() if p.deleted_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else "",
        "updated_at": p.updated_at.isoformat() if p.updated_at else "",
    }


def get_project_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch project document by user ID and document ID."""
    p = session.get(Project, doc_id)
    if not p or p.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, project_to_dict(p))


def set_project_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a project document."""
    p = session.get(Project, doc_id)
    if not p:
        p = Project(
            id=doc_id,
            user_id=user_id,
            name=data.get("name", ""),
            description=data.get("description"),
            status=data.get("status", "Planning"),
            progress=data.get("progress", 0),
            members=data.get("members", 1),
            technologies=data.get("technologies") or [],
            lifecycle_phase=data.get("lifecycle_phase", "idea"),
        )
        session.add(p)
    else:
        if p.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"name", "status", "lifecycle_phase", "progress", "start_date", "end_date", "members", "description", "technologies", "github_url", "live_url"}
        _IMMUTABLE = {"id", "user_id", "created_at"}
        for k, val in data.items():
            if k in {"deleted", "deleted_at"}:
                if hasattr(p, k):
                    setattr(p, k, coerce_model_value(k, val))
                continue
            if k in _IMMUTABLE:
                continue
            if k not in _ALLOWED:
                continue
            if hasattr(p, k):
                setattr(p, k, coerce_model_value(k, val))
    session.commit()


def delete_project_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete a project document by ID."""
    p = session.get(Project, doc_id)
    if not p:
        return
    if user_id is not None and p.user_id != user_id:
        return
    session.delete(p)
    session.commit()


def query_projects(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's projects collection."""
    stmt = select(Project).where(Project.user_id == user_id)
    has_deleted_filter = any(f[0] == "deleted" for f in query.filters)
    if not has_deleted_filter:
        stmt = stmt.where(Project.deleted == False)  # noqa: E712
    for field, op, val in query.filters:
        if field == "deleted" and op in ("==", "="):
            stmt = stmt.where(Project.deleted == val) if val else stmt.where(Project.deleted == False)  # noqa: E712
        elif field == "status" and op in ("==", "="):
            stmt = stmt.where(Project.status == val)
    if query._start_after_doc_id:
        cursor = session.get(Project, query._start_after_doc_id)
        if cursor and cursor.created_at:
            if query._order_by in ("created_at", None) and query._direction == "DESC":
                stmt = stmt.where(Project.created_at < cursor.created_at)
            elif query._order_by == "created_at":
                stmt = stmt.where(Project.created_at > cursor.created_at)
    if query._order_by == "created_at":
        stmt = stmt.order_by(Project.created_at.desc() if query._direction == "DESC" else Project.created_at.asc())
        stmt = stmt.order_by(Project.id.desc() if query._direction == "DESC" else Project.id.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    projects = session.scalars(stmt).all()
    return [SqlSnapshot(p.id, project_to_dict(p)) for p in projects]
