"""Shared workspace repository helpers — facade over core/pagination + collection helpers."""

from datetime import date
from typing import Any

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

# Re-export canonical pagination primitives from core
from app.core.pagination import encode_cursor, decode_cursor, resolve_limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE


def user_collection(database: SqlClient, user_id: str, collection_name: str):
    return database.collection("users").document(user_id).collection(collection_name)


def serialize_dates(values: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value.isoformat() if isinstance(value, date) else value
        for key, value in values.items()
    }


def paginate_collection(collection, order_field: str, cursor: str | None, limit: int):
    # Use server-side deleted filter when available; fall back to Python filter for legacy stores.
    # Fetch limit+1 to detect has_more without over-fetching 3x.
    from fastapi import HTTPException
    try:
        base_query = collection.where("deleted", "==", False)
    except Exception:
        base_query = collection
    query = base_query.order_by(order_field, direction=Query.DESCENDING)
    try:
        cursor_id = decode_cursor(cursor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid pagination cursor.") from exc
    if cursor_id:
        try:
            cursor_doc = collection.document(cursor_id).get()
            # Verify cursor belongs to same collection (owned) and not deleted
            if cursor_doc.exists and not (cursor_doc.to_dict() or {}).get("deleted"):
                query = query.start_after(cursor_doc)
            elif cursor_doc.exists:
                # Deleted cursor — ignore (avoid leaking)
                pass
        except Exception:
            pass
    raw_documents = list(query.limit(limit + 1).stream())
    documents = [d for d in raw_documents if not (d.to_dict() or {}).get("deleted")]
    has_more = len(documents) > limit
    documents = documents[:limit]
    next_cursor = encode_cursor(documents[-1].id) if has_more and documents else None
    return ([{"id": item.id, **(item.to_dict() or {})} for item in documents], next_cursor, has_more)
