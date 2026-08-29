"""Reusable pagination primitives — cursor encode/decode and limit resolution.

Canonical source for pagination; repositories/pagination.py re-exports from here
for backward compatibility. Routes should use resolve_limit() instead of
hand-rolling eff_limit = limit or 20.
"""

import base64
from typing import TypeVar, Generic
from pydantic import BaseModel

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 50

T = TypeVar("T")


def resolve_limit(limit: int | None, default: int = DEFAULT_PAGE_SIZE, max_size: int = MAX_PAGE_SIZE) -> int:
    if limit is None:
        return default
    return max(1, min(int(limit), max_size))


def encode_cursor(document_id: str) -> str:
    return base64.urlsafe_b64encode(document_id.encode()).decode()


def decode_cursor(cursor: str | None) -> str | None:
    if not cursor:
        return None
    if len(cursor) > 512:
        raise ValueError("Invalid pagination cursor.")
    try:
        # Pad base64 if needed
        padded = cursor + "=" * (-len(cursor) % 4)
        return base64.urlsafe_b64decode(padded.encode()).decode()
    except Exception as error:
        raise ValueError("Invalid pagination cursor.") from error


class PageResponse(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    has_more: bool = False
