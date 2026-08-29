"""Studio project routes — single responsibility: project CRUD."""

import asyncio

from fastapi import APIRouter, Depends, status
from app.db import SqlClient, get_firestore

from app.api.routes.studio._shared import bad_request, not_found, require_non_serverless
from app.core.auth import get_current_user
from app.schemas.studio import (
    StudioProjectCreateRequest,
    StudioProjectListResponse,
    StudioProjectResponse,
    StudioProjectUpdateRequest,
)
from app.services.studio import projects as studio_projects

router = APIRouter(prefix="/studio/projects")


def _to_response(project: dict) -> StudioProjectResponse:
    return StudioProjectResponse(
        id=project["id"],
        name=project["name"],
        description=project.get("description", ""),
        type="studio",
        template_id=project.get("template_id"),
        stack=project.get("stack", ""),
        db_preference=project.get("db_preference", "sqlite"),
        auth_enabled=bool(project.get("auth_enabled", False)),
        build_status=project.get("build_status", "draft"),
        plan_status=project.get("plan_status", "none"),
        plan=project.get("plan"),
        git_initialized=bool(project.get("git_initialized", False)),
        github_repo_url=project.get("github_repo_url"),
        published_template_id=project.get("published_template_id"),
        file_count=project.get("file_count", 0),
        created_at=project["created_at"],
        updated_at=project["updated_at"],
    )


@router.get("", response_model=StudioProjectListResponse)
async def list_studio_projects(
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    items = await asyncio.to_thread(studio_projects.list_projects, user["uid"])
    return StudioProjectListResponse(projects=[_to_response(item) for item in items])


@router.post("", response_model=StudioProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_studio_project(
    body: StudioProjectCreateRequest,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    try:
        project = await asyncio.to_thread(
            studio_projects.create_project, user["uid"], body
        )
    except ValueError as error:
        raise bad_request(str(error)) from error
    return _to_response(project)


@router.get("/{workspace_id}", response_model=StudioProjectResponse)
async def get_studio_project(
    workspace_id: str,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    try:
        project = await asyncio.to_thread(
            studio_projects.get_project, user["uid"], workspace_id
        )
    except FileNotFoundError as error:
        raise not_found(str(error)) from error
    response = _to_response(project)
    git = project.get("git") or {}
    response.git_initialized = bool(git.get("initialized"))
    return response


@router.patch("/{workspace_id}", response_model=StudioProjectResponse)
async def update_studio_project(
    workspace_id: str,
    body: StudioProjectUpdateRequest,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    try:
        project = await asyncio.to_thread(
            studio_projects.update_project, user["uid"], workspace_id, updates
        )
    except FileNotFoundError as error:
        raise not_found(str(error)) from error
    return _to_response(project)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_studio_project(
    workspace_id: str,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    deleted = await asyncio.to_thread(
        studio_projects.delete_project, user["uid"], workspace_id
    )
    if not deleted:
        raise not_found(f"Studio project '{workspace_id}' not found.")
    return None
