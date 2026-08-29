"""Studio template routes — single responsibility: catalog, publish, remix."""

import asyncio

from fastapi import APIRouter, Depends, Query
from app.db import SqlClient, get_firestore

from app.api.routes.studio._shared import bad_request, not_found, require_non_serverless
from app.core.auth import get_current_user
from app.schemas.studio import (
    StudioMessageResponse,
    StudioProjectResponse,
    StudioTemplateListResponse,
)
from app.repositories import studio as studio_repo
from app.services.studio import projects as studio_projects
from app.services.studio.templates import list_curated_templates

router = APIRouter(prefix="/studio/templates")


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


@router.get("", response_model=StudioTemplateListResponse)
async def list_templates(
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    """Curated templates + the user's own published templates."""
    require_non_serverless()
    custom = await asyncio.to_thread(studio_repo.list_studio_projects, user["uid"])
    templates = list_curated_templates()
    for project in custom:
        if project.get("published_template_id"):
            templates.append(
                {
                    "id": project["published_template_id"],
                    "name": project["name"],
                    "description": project.get("description", ""),
                    "stack": project.get("stack", ""),
                    "kind": "custom",
                    "source_project_id": project["id"],
                }
            )
    return StudioTemplateListResponse(templates=templates)


@router.post("/{workspace_id}/publish", response_model=StudioMessageResponse)
async def publish_template(
    workspace_id: str,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    try:
        result = await asyncio.to_thread(
            studio_projects.publish_template, user["uid"], workspace_id
        )
    except FileNotFoundError as error:
        raise not_found(str(error)) from error
    return StudioMessageResponse(
        ok=True,
        detail=f"Published as template '{result['template_id']}'.",
    )


@router.post("/{template_id}/remix", response_model=StudioProjectResponse)
async def remix_template(
    template_id: str,
    new_name: str = Query(min_length=1, max_length=100),
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    try:
        project = await asyncio.to_thread(
            studio_projects.remix_template, user["uid"], template_id, new_name.strip()
        )
    except (ValueError, FileNotFoundError) as error:
        raise bad_request(str(error)) from error
    return _to_response(project)
