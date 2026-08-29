"""Reusable service helpers — pagination fetcher and HTTP error mapping."""

from typing import Any, Callable

import httpx


async def fetch_paginated(
    fetcher: Callable[[str | None], tuple[list[Any], str | None]],
    *,
    max_pages: int = 10,
    max_items: int = 200,
) -> list[Any]:
    """Generic paginated fetcher — loops until no next_page_token or limits hit.

    fetcher(next_token) -> (items, next_token)
    """
    all_items: list[Any] = []
    nxt = None
    pages = 0
    while pages < max_pages and len(all_items) < max_items:
        items, nxt = await fetcher(nxt)
        all_items.extend(items)
        pages += 1
        if not nxt:
            break
    return all_items[:max_items]


def http_error_to_service_unavailable(exc: httpx.HTTPStatusError, detail_prefix: str) -> Exception:
    from fastapi import HTTPException, status
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"{detail_prefix}: {exc.response.status_code} {exc.response.text[:200]}")
