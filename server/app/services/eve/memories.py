"""Eve memory helpers - single responsibility: persistent memory cache and instructions builder.

pgvector RAG: when a query is supplied, use semantic search (cosine) to return top 5
relevant memories; otherwise fall back to recent chronological. Keeps 1-10 users lean:
no extra RAM, HNSW index on postgres, in-process dict cache with short TTLs.
"""

import hashlib
import time

from app.db import SqlClient

from app.repositories.eve import list_memories, search_memories
from app.services.eve.instructions import EVE_INSTRUCTIONS

# Chronological fallback cache: user_id -> (expiry, memories)
_memories_cache: dict[str, tuple[float, list[dict]]] = {}
_MEM_TTL = 60  # seconds

# P1: RAG semantic-search cache keyed by (user_id, query_hash).
# 30 s TTL - short enough to stay fresh, long enough to absorb rapid follow-ups.
_RAG_CACHE_TTL = 30  # seconds
_rag_cache: dict[str, tuple[float, list[dict]]] = {}

# P9: Cap injected memories to reduce provider input token cost per turn.
MAX_INJECTED_MEMORIES = 15


def _rag_key(user_id: str, query: str) -> str:
    digest = hashlib.sha256(query.encode()).hexdigest()[:12]
    return f"{user_id}:{digest}"


def _rag_get(user_id: str, query: str) -> list[dict] | None:
    entry = _rag_cache.get(_rag_key(user_id, query))
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def _rag_set(user_id: str, query: str, memories: list[dict]) -> None:
    _rag_cache[_rag_key(user_id, query)] = (time.monotonic() + _RAG_CACHE_TTL, memories)


def get_cached_memories(database: SqlClient, user_id: str) -> list[dict] | None:
    entry = _memories_cache.get(user_id)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None


def set_cached_memories(user_id: str, memories: list[dict]) -> None:
    _memories_cache[user_id] = (time.monotonic() + _MEM_TTL, memories)


def invalidate_memories_cache(user_id: str) -> None:
    _memories_cache.pop(user_id, None)
    # Clear RAG cache for this user so newly saved memories are visible immediately.
    stale = [k for k in _rag_cache if k.startswith(f"{user_id}:")]
    for k in stale:
        _rag_cache.pop(k, None)


def build_memory_instructions(database: SqlClient, user_id: str, query: str | None = None) -> str:
    # P1: RAG path - semantic search with 30 s per-query cache to avoid
    # repeated pgvector cosine calls within the same conversation.
    if query:
        try:
            memories = _rag_get(user_id, query)
            if memories is None:
                memories = search_memories(database, user_id, query, limit=5)
                _rag_set(user_id, query, memories)
            if memories:
                content_key = "content"
                memory_lines = "\n".join(f"- {m[content_key]}" for m in memories)
                return (
                    EVE_INSTRUCTIONS
                    + "\n\nRelevant saved memories for this query (pgvector cosine):\n"
                    + memory_lines
                    + "\n\nAlso you may reference other memories if relevant."
                )
        except Exception:
            pass
    # Chronological fallback path
    cached = get_cached_memories(database, user_id)
    if cached is not None:
        memories = cached
    else:
        memories = list_memories(database, user_id)
        set_cached_memories(user_id, memories)
    if not memories:
        return EVE_INSTRUCTIONS
    # P9: Cap to MAX_INJECTED_MEMORIES to reduce provider input token cost.
    content_key = "content"
    memory_lines = "\n".join(f"- {m[content_key]}" for m in memories[:MAX_INJECTED_MEMORIES])
    return (
        EVE_INSTRUCTIONS
        + "\n\nCurrent saved memories about this user:\n"
        + memory_lines
        + "\nReference these memories when relevant, and remember new important facts the user shares."
    )

