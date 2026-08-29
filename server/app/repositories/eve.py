from datetime import datetime, timezone

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient


def user_collection(database: SqlClient, user_id: str, name: str):
    return database.collection("users").document(user_id).collection(name)


def list_memories(database: SqlClient, user_id: str, limit: int = 100) -> list[dict]:
    query = (
        user_collection(database, user_id, "eve_memories")
        .order_by("created_at", direction=Query.DESCENDING)
        .limit(limit)
    )
    return [{"id": snapshot.id, **(snapshot.to_dict() or {})} for snapshot in query.stream()]


def search_memories(database: SqlClient, user_id: str, query_text: str, limit: int = 5) -> list[dict]:
    """Semantic search via pgvector; falls back to recent on no embedding."""
    try:
        from app.services.embeddings import generate_embedding, is_embedding_available

        if not is_embedding_available() or not query_text.strip():
            return list_memories(database, user_id, limit)
        query_vec = generate_embedding(query_text)
        if not query_vec:
            return list_memories(database, user_id, limit)
        # Try SQL path via compat client session
        from app.db.session import sync_engine
        from app.db.sql.eve import search_eve_memories
        from sqlalchemy.orm import Session

        with Session(sync_engine) as session:
            return search_eve_memories(session, user_id, query_vec, limit)
    except Exception:
        return list_memories(database, user_id, limit)


def add_memory(database: SqlClient, user_id: str, content: str) -> dict:
    reference = user_collection(database, user_id, "eve_memories").document()
    now = datetime.now(timezone.utc).isoformat()
    data: dict = {
        "content": content,
        "created_at": SERVER_TIMESTAMP,
        "updated_at": SERVER_TIMESTAMP,
    }
    # Try to attach pgvector embedding (best-effort, no hard fail for e2-micro without key)
    try:
        from app.services.embeddings import generate_embedding, is_embedding_available

        if is_embedding_available():
            vec = generate_embedding(content)
            if vec:
                data["embedding"] = vec
    except Exception:
        pass
    reference.set(data)
    return {"id": reference.id, "content": content, "created_at": now, "updated_at": now}


def delete_memory(database: SqlClient, user_id: str, memory_id: str) -> bool:
    reference = user_collection(database, user_id, "eve_memories").document(memory_id)
    if not reference.get().exists:
        return False
    reference.delete()
    return True
