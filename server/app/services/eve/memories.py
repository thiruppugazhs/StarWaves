"""Eve memory helpers — single responsibility: persistent memory cache and instructions builder.

pgvector RAG: when a query is supplied, use semantic search (cosine) to return top 5
relevant memories; otherwise fall back to recent 40 chronological. Keeps 1-10 users
lean: no extra RAM, HNSW index on postgres, Redis cache still 60s.
"""

from app.db import SqlClient

from app.repositories.eve import list_memories, search_memories
from app.services.eve.instructions import EVE_INSTRUCTIONS

_memories_cache: dict[str, tuple[float, list[dict]]] = {}
_MEM_TTL = 60  # seconds

def get_cached_memories(database: SqlClient, user_id: str) -> list[dict] | None:
    import time
    entry = _memories_cache.get(user_id)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None

def set_cached_memories(user_id: str, memories: list[dict]) -> None:
    import time
    _memories_cache[user_id] = (time.monotonic() + _MEM_TTL, memories)

def invalidate_memories_cache(user_id: str) -> None:
    _memories_cache.pop(user_id, None)


def build_memory_instructions(database: SqlClient, user_id: str, query: str | None = None) -> str:
    # RAG path: semantic search when query present and pgvector available
    if query:
        try:
            memories = search_memories(database, user_id, query, limit=5)
            if memories:
                memory_lines = "\n".join(f"- {memory['content']}" for memory in memories)
                return (
                    EVE_INSTRUCTIONS
                    + "\n\nRelevant saved memories for this query (pgvector cosine):\n"
                    + memory_lines
                    + "\n\nAlso you may reference other memories if relevant."
                )
        except Exception:
            pass
    cached = get_cached_memories(database, user_id)
    if cached is not None:
        memories = cached
    else:
        memories = list_memories(database, user_id)
        set_cached_memories(user_id, memories)
    if not memories:
        return EVE_INSTRUCTIONS
    memory_lines = "\n".join(f"- {memory['content']}" for memory in memories[:40])
    return (
        EVE_INSTRUCTIONS
        + "\n\nCurrent saved memories about this user:\n"
        + memory_lines
        + "\nReference these memories when relevant, and remember new important facts the user shares."
    )

