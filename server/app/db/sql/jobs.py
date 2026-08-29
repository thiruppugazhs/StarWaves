"""SQL handlers for the 'users/{user_id}/jobs' collection."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import Job

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def job_to_dict(j: Job) -> dict[str, Any]:
    """Serialize Job model to snapshot dictionary."""
    return {
        "id": j.id,
        "company": j.company,
        "role": j.role,
        "status": j.status,
        "location": j.location,
        "work_type": j.work_type,
        "salary": j.salary,
        "applied_date": j.applied_date,
        "resume_id": j.resume_id,
        "job_url": j.job_url,
        "notes": j.notes,
        "deleted": j.deleted,
        "deleted_at": j.deleted_at.isoformat() if j.deleted_at else None,
        "created_at": j.created_at.isoformat() if j.created_at else "",
        "updated_at": j.updated_at.isoformat() if j.updated_at else "",
    }


def get_job_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch job document by user ID and document ID."""
    j = session.get(Job, doc_id)
    if not j or j.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, job_to_dict(j))


def set_job_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a job application document."""
    j = session.get(Job, doc_id)
    if not j:
        j = Job(
            id=doc_id,
            user_id=user_id,
            company=data.get("company", ""),
            role=data.get("role", ""),
            status=data.get("status", "Applied"),
            location=data.get("location"),
            work_type=data.get("work_type"),
            salary=data.get("salary"),
            applied_date=data.get("applied_date"),
            resume_id=data.get("resume_id"),
            job_url=data.get("job_url"),
            notes=data.get("notes"),
        )
        session.add(j)
    else:
        if j.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"company", "role", "status", "location", "work_type", "salary", "applied_date", "resume_id", "job_url", "notes"}
        _IMMUTABLE = {"id", "user_id", "created_at"}
        for k, val in data.items():
            if k in {"deleted", "deleted_at"}:
                if hasattr(j, k):
                    setattr(j, k, coerce_model_value(k, val))
                continue
            if k in _IMMUTABLE:
                continue
            if k not in _ALLOWED:
                continue
            if hasattr(j, k):
                setattr(j, k, coerce_model_value(k, val))
    session.commit()


def delete_job_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete a job document by ID."""
    j = session.get(Job, doc_id)
    if not j:
        return
    if user_id is not None and j.user_id != user_id:
        return
    session.delete(j)
    session.commit()


def query_jobs(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's jobs collection."""
    stmt = select(Job).where(Job.user_id == user_id)
    has_deleted_filter = any(f[0] == "deleted" for f in query.filters)
    if not has_deleted_filter:
        stmt = stmt.where(Job.deleted == False)  # noqa: E712
    for field, op, val in query.filters:
        if field == "deleted" and op in ("==", "="):
            stmt = stmt.where(Job.deleted == val) if val else stmt.where(Job.deleted == False)  # noqa: E712
        elif field == "status" and op in ("==", "="):
            stmt = stmt.where(Job.status == val)
    if query._start_after_doc_id:
        cursor = session.get(Job, query._start_after_doc_id)
        if cursor and cursor.created_at:
            if query._order_by in ("created_at", None) and query._direction == "DESC":
                stmt = stmt.where(
                    or_(
                        Job.created_at < cursor.created_at,
                        and_(Job.created_at == cursor.created_at, Job.id < cursor.id),
                    )
                )
            elif query._order_by == "created_at":
                stmt = stmt.where(
                    or_(
                        Job.created_at > cursor.created_at,
                        and_(Job.created_at == cursor.created_at, Job.id > cursor.id),
                    )
                )
    if query._order_by == "created_at":
        stmt = stmt.order_by(Job.created_at.desc() if query._direction == "DESC" else Job.created_at.asc())
        stmt = stmt.order_by(Job.id.desc() if query._direction == "DESC" else Job.id.asc())
    elif query._order_by == "applied_date":
        stmt = stmt.order_by(Job.applied_date.desc() if query._direction == "DESC" else Job.applied_date.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    jobs = session.scalars(stmt).all()
    return [SqlSnapshot(j.id, job_to_dict(j)) for j in jobs]
