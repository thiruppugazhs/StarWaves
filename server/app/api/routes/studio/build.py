"""Studio build routes — single responsibility: build plans and sandboxed commands."""

import asyncio

from fastapi import APIRouter, Depends
from app.db import SqlClient, get_firestore

from app.api.routes.studio._shared import bad_request, not_found, require_non_serverless
from app.core.auth import get_current_user
from app.schemas.studio import (
    StudioBuildPlanPayload,
    StudioCommandRequest,
    StudioCommandResponse,
    StudioPlanStatusRequest,
    StudioProjectResponse,
)
from app.services.studio import commands as studio_commands
from app.services.studio import projects as studio_projects

router = APIRouter(prefix="/studio/projects")


def _to_response(project: dict) -> StudioProjectResponse:
    return StudioProjectResponse(
        id=project["id"],
        name=project["name"],
        description=project.get("description", ""),
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


@router.put("/{workspace_id}/plan", response_model=StudioProjectResponse)
async def save_build_plan(
    workspace_id: str,
    body: StudioBuildPlanPayload,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    """Store a proposed build plan (Eve submits; UI shows the approval card)."""
    require_non_serverless()
    try:
        project = await asyncio.to_thread(
            studio_projects.save_plan, user["uid"], workspace_id, body.model_dump()
        )
    except FileNotFoundError as error:
        raise not_found(str(error)) from error
    return _to_response(project)


@router.post("/{workspace_id}/plan/status", response_model=StudioProjectResponse)
async def set_plan_status(
    workspace_id: str,
    body: StudioPlanStatusRequest,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    """Approve or reject the pending plan (human-only action from the UI)."""
    require_non_serverless()
    try:
        project = await asyncio.to_thread(
            studio_projects.set_plan_status, user["uid"], workspace_id, body.status
        )
    except FileNotFoundError as error:
        raise not_found(str(error)) from error
    except ValueError as error:
        raise bad_request(str(error)) from error
    return _to_response(project)


@router.post("/{workspace_id}/commands", response_model=StudioCommandResponse)
async def run_command(
    workspace_id: str,
    body: StudioCommandRequest,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    """Run an allowlisted command inside the studio workspace."""
    require_non_serverless()
    result = await asyncio.to_thread(
        studio_commands.run_workspace_command,
        user["uid"],
        workspace_id,
        body.command,
        body.timeout_seconds,
    )
    return StudioCommandResponse(**result)
