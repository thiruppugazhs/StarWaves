"""Authenticated project and asset routes for the 3D modeling workspace."""

import asyncio

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.dependencies import CurrentUserId
from app.core.errors import bad_request, not_found, service_unavailable
from app.schemas.modeling import (
    ModelingAssetResponse,
    ModelingProjectCreateRequest,
    ModelingProjectListResponse,
    ModelingProjectResponse,
    ModelingProjectUpdateRequest,
    ModelingVersionCreateRequest,
    ModelingVersionResponse,
)
from app.services import modeling_projects

router = APIRouter(prefix="/modeling/projects")


def _require_storage() -> None:
    if settings.is_serverless:
        raise service_unavailable("3D project storage is not available in serverless mode.")


def _handle_not_found(error: FileNotFoundError):
    raise not_found(str(error)) from error


@router.get("", response_model=ModelingProjectListResponse)
async def list_modeling_projects(user_id: CurrentUserId):
    _require_storage()
    projects = await asyncio.to_thread(modeling_projects.list_projects, user_id)
    return {"projects": projects}


@router.post("", response_model=ModelingProjectResponse, status_code=201)
async def create_modeling_project(payload: ModelingProjectCreateRequest, user_id: CurrentUserId):
    _require_storage()
    try:
        return await asyncio.to_thread(modeling_projects.create_project, user_id, payload.name, payload.workspace_id)
    except ValueError as error:
        raise bad_request(str(error)) from error


@router.get("/{project_id}", response_model=ModelingProjectResponse)
async def get_modeling_project(project_id: str, user_id: CurrentUserId, workspace_id: str = "default"):
    _require_storage()
    try:
        return await asyncio.to_thread(modeling_projects.get_project, user_id, project_id, workspace_id)
    except FileNotFoundError as error:
        _handle_not_found(error)


@router.patch("/{project_id}", response_model=ModelingProjectResponse)
async def update_modeling_project(project_id: str, payload: ModelingProjectUpdateRequest, user_id: CurrentUserId, workspace_id: str = "default"):
    _require_storage()
    try:
        return await asyncio.to_thread(modeling_projects.update_project, user_id, project_id, payload.name, workspace_id)
    except FileNotFoundError as error:
        _handle_not_found(error)


@router.delete("/{project_id}", status_code=204)
async def delete_modeling_project(project_id: str, user_id: CurrentUserId, workspace_id: str = "default"):
    _require_storage()
    try:
        await asyncio.to_thread(modeling_projects.delete_project, user_id, project_id, workspace_id)
    except FileNotFoundError as error:
        _handle_not_found(error)


@router.post("/{project_id}/versions", response_model=ModelingVersionResponse, status_code=201)
async def save_modeling_version(project_id: str, payload: ModelingVersionCreateRequest, user_id: CurrentUserId, workspace_id: str = "default"):
    _require_storage()
    try:
        return await asyncio.to_thread(modeling_projects.save_version, user_id, project_id, payload.scene, payload.message, workspace_id)
    except FileNotFoundError as error:
        _handle_not_found(error)


@router.get("/{project_id}/versions/{version_id}", response_model=ModelingVersionResponse)
async def get_modeling_version(project_id: str, version_id: str, user_id: CurrentUserId, workspace_id: str = "default"):
    _require_storage()
    try:
        return await asyncio.to_thread(modeling_projects.get_version, user_id, project_id, version_id, workspace_id)
    except FileNotFoundError as error:
        _handle_not_found(error)


@router.post("/{project_id}/assets", response_model=ModelingAssetResponse, status_code=201)
async def upload_modeling_asset(
    project_id: str,
    user_id: CurrentUserId,
    file: UploadFile = File(...),
    relative_path: str | None = Form(default=None),
    asset_set_id: str | None = Form(default=None),
    workspace_id: str = Form(default="default"),
):
    _require_storage()
    content = await file.read(settings.modeling_asset_max_bytes + 1)
    if len(content) > settings.modeling_asset_max_bytes:
        raise bad_request("Modeling asset exceeds the configured size limit.")
    try:
        return await asyncio.to_thread(
            modeling_projects.save_asset,
            user_id,
            project_id,
            file.filename or "asset",
            content,
            file.content_type or "application/octet-stream",
            relative_path,
            asset_set_id,
            workspace_id,
        )
    except FileNotFoundError as error:
        _handle_not_found(error)
    except ValueError as error:
        raise bad_request(str(error)) from error


@router.get("/{project_id}/assets", response_model=list[ModelingAssetResponse])
async def list_modeling_assets(project_id: str, user_id: CurrentUserId, workspace_id: str = "default"):
    _require_storage()
    try:
        return await asyncio.to_thread(modeling_projects.list_assets, user_id, project_id, workspace_id)
    except FileNotFoundError as error:
        _handle_not_found(error)


@router.get("/{project_id}/assets/{asset_id}")
async def download_modeling_asset(project_id: str, asset_id: str, user_id: CurrentUserId, workspace_id: str = "default"):
    _require_storage()
    try:
        path, asset = await asyncio.to_thread(modeling_projects.get_asset_path, user_id, project_id, asset_id, workspace_id)
    except FileNotFoundError as error:
        _handle_not_found(error)
    return FileResponse(path, media_type=asset.get("content_type") or "application/octet-stream", filename=asset.get("filename"))


@router.delete("/{project_id}/assets/{asset_id}", status_code=204)
async def delete_modeling_asset(project_id: str, asset_id: str, user_id: CurrentUserId, workspace_id: str = "default"):
    _require_storage()
    try:
        await asyncio.to_thread(modeling_projects.delete_asset, user_id, project_id, asset_id, workspace_id)
    except FileNotFoundError as error:
        _handle_not_found(error)
