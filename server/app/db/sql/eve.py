"""SQL handlers for Eve AI Assistant collections ('eve_sessions', 'eve_memories',
and 'eve_schedules')."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.sql._shared import coerce_model_value
from app.db.sql.query import SqlSnapshot
from app.models import EveMemory, EveSchedule, EveSession

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def eve_session_to_dict(s: EveSession) -> dict[str, Any]:
    """Serialize EveSession model to snapshot dictionary."""
    return {
        "id": s.id,
        "title": s.title,
        "messages": s.messages or [],
        "created_at": s.created_at.isoformat() if s.created_at else "",
        "updated_at": s.updated_at.isoformat() if s.updated_at else "",
    }


def eve_memory_to_dict(m: EveMemory) -> dict[str, Any]:
    """Serialize EveMemory model to snapshot dictionary."""
    return {
        "id": m.id,
        "content": m.content,
        "created_at": m.created_at.isoformat() if m.created_at else "",
        "updated_at": m.updated_at.isoformat() if m.updated_at else "",
    }


def _cosine_sim(a: list[float], b: list[float]) -> float:
    """In-process cosine fallback for SQLite/tests without pgvector."""
    if not a or not b or len(a) != len(b):
        return -1.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return -1.0
    return dot / (norm_a * norm_b)


def get_eve_session_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch Eve chat session by user ID and session ID."""
    s = session.get(EveSession, doc_id)
    if not s or s.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, eve_session_to_dict(s))


def set_eve_session_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update an Eve chat session."""
    s = session.get(EveSession, doc_id)
    if not s:
        s = EveSession(
            id=doc_id,
            user_id=user_id,
            title=data.get("title", "New chat"),
            messages=data.get("messages") or [],
        )
        session.add(s)
    else:
        if s.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"title", "messages"}
        _IMMUTABLE = {"id", "user_id", "created_at"}
        for k, val in data.items():
            if k in _IMMUTABLE:
                continue
            if k not in _ALLOWED:
                continue
            if hasattr(s, k):
                setattr(s, k, coerce_model_value(k, val))
    session.commit()


def delete_eve_session_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete an Eve chat session by ID."""
    s = session.get(EveSession, doc_id)
    if not s:
        return
    if user_id is not None and s.user_id != user_id:
        return
    session.delete(s)
    session.commit()


def query_eve_sessions(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's eve_sessions collection."""
    stmt = select(EveSession).where(EveSession.user_id == user_id)
    if query._start_after_doc_id:
        cursor = session.get(EveSession, query._start_after_doc_id)
        if cursor:
            ts = cursor.updated_at or cursor.created_at
            if ts:
                if query._order_by == "updated_at" and query._direction == "DESC":
                    stmt = stmt.where(EveSession.updated_at < ts)
                elif query._order_by == "updated_at":
                    stmt = stmt.where(EveSession.updated_at > ts)
    if query._order_by == "updated_at":
        stmt = stmt.order_by(EveSession.updated_at.desc() if query._direction == "DESC" else EveSession.updated_at.asc())
        stmt = stmt.order_by(EveSession.id.desc() if query._direction == "DESC" else EveSession.id.asc())
    elif query._order_by == "created_at":
        stmt = stmt.order_by(EveSession.created_at.desc() if query._direction == "DESC" else EveSession.created_at.asc())
        stmt = stmt.order_by(EveSession.id.desc() if query._direction == "DESC" else EveSession.id.asc())
    else:
        stmt = stmt.order_by(EveSession.updated_at.desc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    sessions = session.scalars(stmt).all()
    return [SqlSnapshot(s.id, eve_session_to_dict(s)) for s in sessions]


def get_eve_memory_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch Eve memory entry by user ID and memory ID."""
    m = session.get(EveMemory, doc_id)
    if not m or m.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, eve_memory_to_dict(m))


def set_eve_memory_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update an Eve persistent memory."""
    m = session.get(EveMemory, doc_id)
    emb = data.get("embedding")
    # coerce embedding: pgvector accepts list[float], JSON fallback stores same
    if not m:
        m = EveMemory(
            id=doc_id,
            user_id=user_id,
            content=data.get("content", ""),
            embedding=emb,
        )
        session.add(m)
    else:
        if m.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"content", "embedding"}
        _IMMUTABLE = {"id", "user_id", "created_at"}
        for k, val in data.items():
            if k in _IMMUTABLE:
                continue
            if k not in _ALLOWED:
                continue
            if hasattr(m, k):
                if k == "embedding" and val is not None:
                    setattr(m, k, val)
                elif k != "embedding":
                    setattr(m, k, coerce_model_value(k, val))
                else:
                    setattr(m, k, val)
    session.commit()


def delete_eve_memory_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete an Eve memory entry by ID."""
    m = session.get(EveMemory, doc_id)
    if not m:
        return
    if user_id is not None and m.user_id != user_id:
        return
    session.delete(m)
    session.commit()


def query_eve_memories(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's eve_memories collection."""
    stmt = select(EveMemory).where(EveMemory.user_id == user_id)
    if query._order_by == "created_at":
        stmt = stmt.order_by(EveMemory.created_at.desc() if query._direction == "DESC" else EveMemory.created_at.asc())
    if query._limit:
        stmt = stmt.limit(query._limit)
    memories = session.scalars(stmt).all()
    return [SqlSnapshot(m.id, eve_memory_to_dict(m)) for m in memories]


def search_eve_memories(
    session: Session, user_id: str, query_embedding: list[float], limit: int = 5
) -> list[dict[str, Any]]:
    """Vector search for Eve memories (pgvector cosine) with SQLite fallback."""
    try:
        # Try pgvector: SELECT ... ORDER BY embedding <=> query_vec LIMIT
        # importing Vector ensures operator available; fallback if extension missing
        from sqlalchemy import text as _text

        # Use raw SQL for pgvector operator when available (SQLite will error and fallback)
        # HNSW index requires: embedding <=> :vec ; we normalize via cosine distance
        # Note: psycopg adapter expects vector as string " [0.1,0.2...]"
        vec_str = "[" + ",".join(str(float(x)) for x in query_embedding) + "]"
        sql = _text(
            """
            SELECT id, content, created_at, updated_at
            FROM eve_memories
            WHERE user_id = :uid AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :lim
            """
        )
        rows = session.execute(sql, {"uid": user_id, "vec": vec_str, "lim": limit}).fetchall()
        if rows:
            return [
                {
                    "id": r[0],
                    "content": r[1],
                    "created_at": r[2].isoformat() if hasattr(r[2], "isoformat") else str(r[2]),
                    "updated_at": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3]),
                }
                for r in rows
            ]
        # Empty vector result → fallback to python scan
        raise ValueError("empty pgvector result, fallback")
    except Exception:
        # SQLite/python fallback: fetch all with embedding and cosine rank
        stmt = select(EveMemory).where(EveMemory.user_id == user_id).where(EveMemory.embedding.is_not(None))  # type: ignore
        candidates = session.scalars(stmt).all()
        scored = []
        for m in candidates:
            emb = getattr(m, "embedding", None)
            if isinstance(emb, str):
                # JSON-string fallback
                try:
                    import json

                    emb = json.loads(emb)
                except Exception:
                    continue
            if not emb:
                continue
            score = _cosine_sim(query_embedding, emb if isinstance(emb, list) else list(emb))
            scored.append((score, m))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = [m for score, m in scored[:limit] if score > -1]
        # If no embeddings yet, fallback to recent
        if not top:
            stmt2 = select(EveMemory).where(EveMemory.user_id == user_id).order_by(EveMemory.created_at.desc()).limit(limit)
            top = session.scalars(stmt2).all()
        return [eve_memory_to_dict(m) for m in top]


# ---------------------------------------------------------------------------
# Eve schedules (users/{uid}/eve_schedules)
# ---------------------------------------------------------------------------

_SCHEDULE_COLUMN_ALIASES: dict[str, str] = {}


def eve_schedule_to_dict(s: EveSchedule) -> dict[str, Any]:
    """Serialize EveSchedule model to snapshot dictionary (Firestore shape)."""
    return {
        "id": s.id,
        "user_id": s.user_id,
        "title": s.title or "Automated Schedule",
        "prompt": s.prompt,
        "schedule_type": s.schedule_type or "one_time",
        "action_type": s.action_type or "chat_prompt",
        "execute_at": s.execute_at.isoformat() if s.execute_at else None,
        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
        "cron_expression": s.cron_expression,
        "enabled": bool(s.enabled),
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else "",
        "updated_at": s.updated_at.isoformat() if s.updated_at else "",
    }


def get_eve_schedule_doc(session: Session, user_id: str, doc_id: str) -> SqlSnapshot:
    """Fetch schedule document by user ID and document ID."""
    s = session.get(EveSchedule, doc_id)
    if not s or s.user_id != user_id:
        return SqlSnapshot(doc_id, None, exists=False)
    return SqlSnapshot(doc_id, eve_schedule_to_dict(s))


def set_eve_schedule_doc(
    session: Session,
    user_id: str,
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Create or update a schedule document."""
    s = session.get(EveSchedule, doc_id)
    if not s:
        s = EveSchedule(
            id=doc_id,
            user_id=user_id,
            prompt=data.get("prompt"),
            action_type=data.get("action_type", "chat_prompt"),
            cron_expression=data.get("cron_expression"),
        )
        session.add(s)
    else:
        if s.user_id != user_id:
            raise PermissionError("Not owner")
        _ALLOWED = {"title", "prompt", "schedule_type", "action_type", "cron_expression", "execute_at", "next_run_at", "enabled", "last_run_at"}
        _IMMUTABLE = {"id", "user_id", "created_at"}
        for key, val in data.items():
            if key in _IMMUTABLE:
                continue
            column = _SCHEDULE_COLUMN_ALIASES.get(key, key)
            if column in _IMMUTABLE or column not in _ALLOWED:
                continue
            if hasattr(s, column):
                setattr(s, column, coerce_model_value(column, val))
    session.commit()


def delete_eve_schedule_doc(session: Session, doc_id: str, user_id: str | None = None) -> None:
    """Delete a schedule document by ID."""
    s = session.get(EveSchedule, doc_id)
    if not s:
        return
    if user_id is not None and s.user_id != user_id:
        return
    session.delete(s)
    session.commit()


def query_eve_schedules(session: Session, user_id: str, query: SqlQuery) -> list[SqlSnapshot]:
    """Execute query on the user's schedules collection."""
    stmt = select(EveSchedule).where(EveSchedule.user_id == user_id)
    for field, op, val in query.filters:
        if op in ("==", "=") and hasattr(EveSchedule, field):
            stmt = stmt.where(getattr(EveSchedule, field) == val)
    if query._order_by == "created_at":
        stmt = stmt.order_by(
            EveSchedule.created_at.desc() if query._direction == "DESC"
            else EveSchedule.created_at.asc()
        )
    if query._limit:
        stmt = stmt.limit(query._limit)
    return [SqlSnapshot(s.id, eve_schedule_to_dict(s)) for s in session.scalars(stmt).all()]
