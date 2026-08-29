"""Notification routes: list, update, delete, and mark all as read."""

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.db import SqlClient, get_firestore

from app.api.routes.workspace._shared import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_MEDIUM, CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.repositories import NotificationRepository
from app.schemas.workspace import NotificationResponse, NotificationUpdate, PageResponse

router = APIRouter()

_WS_NOTIFICATIONS_PREFIX = "workspace:notifications"


def _invalidate_ws_notifications(user_id: str) -> None:
    cache_invalidate_prefix(f"{_WS_NOTIFICATIONS_PREFIX}:{user_id}")


@router.get("/notifications", response_model=PageResponse)
@cached(ttl=CACHE_TTL_SHORT, prefix=_WS_NOTIFICATIONS_PREFIX)
async def list_notifications(
    cursor: str | None = None,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = NotificationRepository(database, user["uid"])
    items, next_cursor, has_more = await asyncio.to_thread(repository.list_page, cursor, limit)
    return {"items": items, "next_cursor": next_cursor, "has_more": has_more}


@router.get("/notifications/{notification_id}", response_model=NotificationResponse)
@cached(ttl=CACHE_TTL_MEDIUM, prefix=_WS_NOTIFICATIONS_PREFIX)
async def get_notification(
    notification_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = NotificationRepository(database, user["uid"])
    result = await asyncio.to_thread(repository.get, notification_id)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return result


@router.patch("/notifications/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: str,
    changes: NotificationUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = NotificationRepository(database, user["uid"])
    result = await asyncio.to_thread(repository.update, notification_id, changes)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found.")
    _invalidate_ws_notifications(user["uid"])
    return result


@router.delete("/notifications/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = NotificationRepository(database, user["uid"])
    ok = await asyncio.to_thread(repository.delete, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found.")
    _invalidate_ws_notifications(user["uid"])
    return Response(status_code=204)


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = NotificationRepository(database, user["uid"])
    updated_count = await asyncio.to_thread(repository.mark_all_read)
    _invalidate_ws_notifications(user["uid"])
    return {"updated": updated_count}


@router.post("/notifications/{notification_id}/restore", response_model=NotificationResponse)
async def restore_notification(
    notification_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = NotificationRepository(database, user["uid"])
    ok = await asyncio.to_thread(repository.restore, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found.")
    result = await asyncio.to_thread(repository.get, notification_id)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found.")
    _invalidate_ws_notifications(user["uid"])
    return result
