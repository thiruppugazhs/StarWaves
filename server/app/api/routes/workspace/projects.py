"""Project routes: list, create, patch, and delete workspace projects."""

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.db import SqlClient, get_firestore

from app.api.routes.workspace._shared import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_MEDIUM, CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.repositories import ProjectRepository
from app.schemas.workspace import PageResponse, ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter()

_WS_PROJECTS_PREFIX = "workspace:projects"


def _invalidate_ws_projects(user_id: str) -> None:
    cache_invalidate_prefix(f"{_WS_PROJECTS_PREFIX}:{user_id}")


@router.get("/projects", response_model=PageResponse)
@cached(ttl=CACHE_TTL_SHORT, prefix=_WS_PROJECTS_PREFIX)
async def list_projects(
    cursor: str | None = None,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = ProjectRepository(database, user["uid"])
    items, next_cursor, has_more = await asyncio.to_thread(repository.list_page, cursor, limit)
    return {"items": items, "next_cursor": next_cursor, "has_more": has_more}


@router.get("/projects/{project_id}", response_model=ProjectResponse)
@cached(ttl=CACHE_TTL_MEDIUM, prefix=_WS_PROJECTS_PREFIX)
async def get_project(
    project_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = ProjectRepository(database, user["uid"])
    result = await asyncio.to_thread(repository.get, project_id)
    if not result:
        raise HTTPException(status_code=404, detail="Project not found.")
    return result


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    project: ProjectCreate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = ProjectRepository(database, user["uid"])
    result = await asyncio.to_thread(repository.create, project)
    _invalidate_ws_projects(user["uid"])
    return result


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def patch_project(
    project_id: str,
    changes: ProjectUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = ProjectRepository(database, user["uid"])
    updates = changes.model_dump(exclude_unset=True)
    result = await asyncio.to_thread(repository.patch, project_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Project not found.")
    _invalidate_ws_projects(user["uid"])
    return result


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = ProjectRepository(database, user["uid"])
    ok = await asyncio.to_thread(repository.delete, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found.")
    _invalidate_ws_projects(user["uid"])
    return Response(status_code=204)


@router.post("/projects/{project_id}/restore", response_model=ProjectResponse)
async def restore_project(
    project_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = ProjectRepository(database, user["uid"])
    ok = await asyncio.to_thread(repository.restore, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found.")
    result = await asyncio.to_thread(repository.get, project_id)
    if not result:
        raise HTTPException(status_code=404, detail="Project not found.")
    _invalidate_ws_projects(user["uid"])
    return result
