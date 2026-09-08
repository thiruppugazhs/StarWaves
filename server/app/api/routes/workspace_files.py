import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.cache import cache_delete, cache_get, cache_set
from app.core.config import settings
from app.core.sync import broadcast_invalidate
from app.repositories import workspace_files

_TREE_TTL = 3  # seconds
_TREE_PREFIX = "ws:tree"


def _tree_cache_key(user_id: str, workspace_id: str) -> str:
    return f"{_TREE_PREFIX}:{user_id}:{workspace_id}"


def _get_tree_cache(user_id: str, workspace_id: str):
    return cache_get(_tree_cache_key(user_id, workspace_id))


def _set_tree_cache(user_id: str, workspace_id: str, data: list):
    cache_set(_tree_cache_key(user_id, workspace_id), data, ttl=_TREE_TTL)


def _invalidate_tree_cache(user_id: str, workspace_id: str | None = None):
    if workspace_id:
        cache_delete(_tree_cache_key(user_id, workspace_id))
    else:
        from app.core.cache import cache_invalidate_prefix
        cache_invalidate_prefix(f"{_TREE_PREFIX}:{user_id}")
from app.schemas.workspace_files import (
    WorkspaceCreateRequest,
    WorkspaceFileReadResponse,
    WorkspaceFileWriteRequest,
    WorkspaceItem,
    WorkspaceListResponse,
    WorkspaceRenameRequest,
    WorkspaceSyncRequest,
    WorkspaceSyncResponse,
    WorkspaceTreeResponse,
)

router = APIRouter(prefix="/workspace-files")


def _require_non_serverless():
    if getattr(settings, "is_serverless", False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Workspace file storage is not available in serverless mode.",
        )


# Workspace Management Endpoints
@router.get("/workspaces", response_model=WorkspaceListResponse)
async def get_workspaces(
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    items = await asyncio.to_thread(workspace_files.list_workspaces, user["uid"])
    return WorkspaceListResponse(
        workspaces=[WorkspaceItem(**item) for item in items],
        active_id=items[0]["id"] if items else "default",
    )


@router.post("/workspaces", response_model=WorkspaceItem, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreateRequest,
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    try:
        created = await asyncio.to_thread(workspace_files.create_workspace, user["uid"], body.name)
        _invalidate_tree_cache(user["uid"])
        await broadcast_invalidate(user["uid"], "workspace_files", {"workspace_id": created.get("id")})
        return WorkspaceItem(**created)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceItem)
async def rename_workspace(
    workspace_id: str,
    body: WorkspaceRenameRequest,
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    try:
        updated = await asyncio.to_thread(workspace_files.rename_workspace, user["uid"], workspace_id, body.name)
        _invalidate_tree_cache(user["uid"], workspace_id)
        return WorkspaceItem(**updated)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str,
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    ok = await asyncio.to_thread(workspace_files.delete_workspace, user["uid"], workspace_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    _invalidate_tree_cache(user["uid"], workspace_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Workspace Files Endpoints
@router.get("/tree", response_model=WorkspaceTreeResponse)
async def get_file_tree(
    workspace_id: str = Query(default="default"),
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    cached = _get_tree_cache(user["uid"], workspace_id)
    if cached is not None:
        return WorkspaceTreeResponse(root="/", files=cached)
    files = await asyncio.to_thread(workspace_files.list_tree, user["uid"], workspace_id)
    _set_tree_cache(user["uid"], workspace_id, files)
    return WorkspaceTreeResponse(root="/", files=files)


@router.get("/{file_path:path}", response_model=WorkspaceFileReadResponse)
async def read_file(
    file_path: str,
    workspace_id: str = Query(default="default"),
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    try:
        content, size = await asyncio.to_thread(workspace_files.read_file, user["uid"], file_path, workspace_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found.")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return WorkspaceFileReadResponse(path=file_path, content=content, size=size)


@router.put("/{file_path:path}", status_code=status.HTTP_200_OK)
async def write_file(
    file_path: str,
    body: WorkspaceFileWriteRequest,
    workspace_id: str = Query(default="default"),
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    try:
        size = await asyncio.to_thread(workspace_files.write_file, user["uid"], file_path, body.content, body.encoding, workspace_id)
        _invalidate_tree_cache(user["uid"], workspace_id)
        await broadcast_invalidate(user["uid"], "workspace_files", {"workspace_id": workspace_id})
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return {"path": file_path, "size": size, "written": True}


@router.delete("/{file_path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_path: str,
    workspace_id: str = Query(default="default"),
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    try:
        ok = await asyncio.to_thread(workspace_files.delete_file, user["uid"], file_path, workspace_id)
        if not ok:
            raise HTTPException(status_code=404, detail="File not found.")
        _invalidate_tree_cache(user["uid"], workspace_id)
        await broadcast_invalidate(user["uid"], "workspace_files", {"workspace_id": workspace_id})
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sync", response_model=WorkspaceSyncResponse)
async def sync_files(
    body: WorkspaceSyncRequest,
    workspace_id: str = Query(default="default"),
    user: dict = Depends(get_current_user),
):
    _require_non_serverless()
    # Caps for e2-micro: max 50 files, 10MB total, bounded concurrency 5
    MAX_SYNC_FILES = 50
    MAX_SYNC_BYTES = 10 * 1024 * 1024
    if len(body.files) > MAX_SYNC_FILES:
        raise HTTPException(status_code=400, detail=f"Sync limited to {MAX_SYNC_FILES} files per request (got {len(body.files)}).")
    total_bytes = sum(len((e.content or "").encode("utf-8")) for e in body.files)
    if total_bytes > MAX_SYNC_BYTES:
        raise HTTPException(status_code=400, detail=f"Sync payload too large: {total_bytes} bytes > {MAX_SYNC_BYTES}.")
    import asyncio as _asyncio

    sem = _asyncio.Semaphore(5)

    async def _write(entry):
        async with sem:
            try:
                await _asyncio.to_thread(workspace_files.write_file, user["uid"], entry.path, entry.content, entry.encoding, workspace_id)
                return (True, None)
            except (ValueError, OSError) as error:
                return (False, f"{entry.path}: {error}")

    results = await _asyncio.gather(*[_write(e) for e in body.files])
    synced = sum(1 for ok, _ in results if ok)
    errors = [err for ok, err in results if not ok and err]
    if synced:
        _invalidate_tree_cache(user["uid"], workspace_id)
        await broadcast_invalidate(user["uid"], "workspace_files", {"workspace_id": workspace_id})
    return WorkspaceSyncResponse(synced=synced, errors=errors)

