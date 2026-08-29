"""Job routes: list, create, update, and delete workspace jobs."""

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.db import SqlClient, get_firestore

from app.api.routes.workspace._shared import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_MEDIUM, CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.repositories import JobRepository
from app.schemas.workspace import JobCreate, JobResponse, JobUpdate, PageResponse

router = APIRouter()

_WS_JOBS_PREFIX = "workspace:jobs"


def _invalidate_ws_jobs(user_id: str) -> None:
    cache_invalidate_prefix(f"{_WS_JOBS_PREFIX}:{user_id}")


@router.get("/jobs", response_model=PageResponse)
@cached(ttl=CACHE_TTL_SHORT, prefix=_WS_JOBS_PREFIX)
async def list_jobs(
    cursor: str | None = None,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = JobRepository(database, user["uid"])
    items, next_cursor, has_more = await asyncio.to_thread(repository.list_page, cursor, limit)
    return {"items": items, "next_cursor": next_cursor, "has_more": has_more}


@router.get("/jobs/{job_id}", response_model=JobResponse)
@cached(ttl=CACHE_TTL_MEDIUM, prefix=_WS_JOBS_PREFIX)
async def get_job(
    job_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = JobRepository(database, user["uid"])
    result = await asyncio.to_thread(repository.get, job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found.")
    return result


@router.post("/jobs", response_model=JobResponse, status_code=201)
async def create_job(
    job: JobCreate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = JobRepository(database, user["uid"])
    result = await asyncio.to_thread(repository.create, job)
    _invalidate_ws_jobs(user["uid"])
    return result


@router.patch("/jobs/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    changes: JobUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = JobRepository(database, user["uid"])
    updates = changes.model_dump(exclude_unset=True)
    result = await asyncio.to_thread(repository.update, job_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found.")
    _invalidate_ws_jobs(user["uid"])
    return result


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(
    job_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = JobRepository(database, user["uid"])
    ok = await asyncio.to_thread(repository.delete, job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found.")
    _invalidate_ws_jobs(user["uid"])
    return Response(status_code=204)


@router.post("/jobs/{job_id}/restore", response_model=JobResponse)
async def restore_job(
    job_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = JobRepository(database, user["uid"])
    ok = await asyncio.to_thread(repository.restore, job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found.")
    result = await asyncio.to_thread(repository.get, job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found.")
    _invalidate_ws_jobs(user["uid"])
    return result
