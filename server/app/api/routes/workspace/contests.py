"""Contest route: aggregated upcoming contests across platforms, with caching."""

import asyncio
import time
from typing import Any

import httpx
from fastapi import APIRouter, Query

from app.api.routes.workspace._shared import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.pagination import decode_cursor, encode_cursor
from app.schemas.workspace import PageResponse
from app.services.contests import codechef_contests, codeforces_contests, leetcode_contests

router = APIRouter()

CONTEST_CACHE_TTL = 10 * 60
_contest_cache: tuple[float, list[dict]] | None = None
CONTEST_REQUEST_TIMEOUT = httpx.Timeout(8.0, connect=2.0)


def _contest_sort_key(contest: dict[str, Any]) -> tuple[str, str]:
    """Stable sort key: starts at first, then a tiebreaker per contest id."""
    return (contest["startsAt"], contest["id"])


@router.get("/contests", response_model=PageResponse)
async def list_contests(
    cursor: str | None = None,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
):
    global _contest_cache
    if _contest_cache and _contest_cache[0] > time.monotonic():
        platforms = _contest_cache[1]
    else:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/126 Safari/537.36"
            ),
        }
        async with httpx.AsyncClient(
            timeout=CONTEST_REQUEST_TIMEOUT,
            follow_redirects=True,
            headers=headers,
        ) as client:
            platforms = await asyncio.gather(
                codeforces_contests(client),
                codechef_contests(client),
                leetcode_contests(client),
            )
        platforms = [platform for platform in platforms if platform is not None]
        if platforms:
            _contest_cache = (time.monotonic() + CONTEST_CACHE_TTL, platforms)

    records = []
    for platform in platforms:
        records.extend(
            {**contest, "platformId": platform["id"]} for contest in platform["contests"]
        )
    records.sort(key=_contest_sort_key)

    # Stable keyset pagination: the cursor stores the last delivered sort key,
    # so newly inserted contests do not shift previously-returned pages.
    page = records
    if cursor:
        last_start, last_id = (decode_cursor(cursor) or "\x00").split("\t", 1)
        page = [
            contest
            for contest in records
            if (contest["startsAt"], contest["id"]) > (last_start, last_id)
        ]

    items = page[:limit]
    next_cursor = None
    if len(page) > limit:
        final = items[-1]
        next_cursor = encode_cursor(f"{final['startsAt']}\t{final['id']}")
    return {"items": items, "next_cursor": next_cursor, "has_more": next_cursor is not None}
