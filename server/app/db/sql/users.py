"""SQL handlers for the 'users' collection."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import User

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def user_to_dict(u: User) -> dict[str, Any]:
    """Convert User model instance to Firestore snapshot dictionary."""
    return {
        "uid": u.id,
        "email": u.email,
        "name": u.name,
        "display_name": u.display_name,
        "avatar_url": u.avatar_url,
        "password_hash": u.password_hash,
        "password_salt": u.password_salt,
        "google_auth": u.google_auth,
        "combined_accounts": u.combined_accounts or [],
        "created_at": u.created_at.isoformat() if u.created_at else "",
        "updated_at": u.updated_at.isoformat() if u.updated_at else "",
    }


def get_user_doc(session: Session, doc_id: str) -> SqlSnapshot:
    """Fetch user document by ID."""
    u = session.get(User, doc_id)
    if not u:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, user_to_dict(u))


def set_user_doc(
    session: Session,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a user document."""
    u = session.get(User, doc_id)
    if not u:
        u = User(
            id=doc_id,
            email=data.get("email", ""),
            name=data.get("name"),
            display_name=data.get("display_name"),
            avatar_url=data.get("avatar_url") or data.get("picture"),
            password_hash=data.get("password_hash"),
            password_salt=data.get("password_salt"),
            google_auth=data.get("google_auth"),
            combined_accounts=data.get("combined_accounts") or [],
        )
        session.add(u)
    else:
        for k, val in data.items():
            if hasattr(u, k):
                setattr(u, k, coerce_model_value(k, val))
    session.commit()


def delete_user_doc(session: Session, doc_id: str) -> None:
    """Delete a user document by ID."""
    u = session.get(User, doc_id)
    if u:
        session.delete(u)
        session.commit()


def query_users(session: Session, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the users collection."""
    stmt = select(User)
    for field, op, val in query.filters:
        if field == "email" and op in ("==", "="):
            stmt = stmt.where(func.lower(User.email) == str(val).lower().strip())
    if query._limit:
        stmt = stmt.limit(query._limit)
    users = session.scalars(stmt).all()
    return [SqlSnapshot(u.id, user_to_dict(u)) for u in users]
