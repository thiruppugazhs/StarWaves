"""Studio git routes — single responsibility: version history + GitHub sync."""

import asyncio

from fastapi import APIRouter, Depends
from app.db import SqlClient, get_firestore

from app.api.routes.studio._shared import bad_request, not_found, require_non_serverless
from app.core.auth import get_current_user
from app.schemas.studio import (
    StudioGitCommitRequest,
    StudioGitConnectRequest,
    StudioGitStatusResponse,
    StudioMessageResponse,
)
from app.services.studio import git_ops
from app.services.studio import projects as studio_projects

router = APIRouter(prefix="/studio/projects/{workspace_id}/git")


def _get_github_token(database: SqlClient, user_id: str) -> str | None:
    """Best-effort lookup of the user's connected GitHub OAuth token."""
    from app.services.oauth import decrypt_token

    accounts = (
        database.collection("users")
        .document(user_id)
        .collection("integrations")
        .document("github")
        .collection("accounts")
        .limit(1)
        .stream()
    )
    for doc in accounts:
        encrypted = (doc.to_dict() or {}).get("access_token")
        if encrypted:
            try:
                return decrypt_token(encrypted)
            except Exception:  # noqa: BLE001 - token decrypt must never break pushes
                return None
    return None


@router.get("/status", response_model=StudioGitStatusResponse)
async def git_status(
    workspace_id: str,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    status = await asyncio.to_thread(git_ops.status, user["uid"], workspace_id)
    return StudioGitStatusResponse(**status)


@router.post("/commit", response_model=StudioMessageResponse)
async def git_commit(
    workspace_id: str,
    body: StudioGitCommitRequest,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    require_non_serverless()
    try:
        result = await asyncio.to_thread(
            git_ops.commit_all, user["uid"], workspace_id, body.message.strip()
        )
    except git_ops.GitUnavailableError as error:
        raise bad_request(str(error)) from error
    return StudioMessageResponse(ok=result["committed"], detail=result["detail"])


@router.post("/github", response_model=StudioMessageResponse)
async def connect_github(
    workspace_id: str,
    body: StudioGitConnectRequest,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    """Point the project's origin remote at a GitHub repository URL."""
    require_non_serverless()
    try:
        await asyncio.to_thread(git_ops.set_remote, user["uid"], workspace_id, body.repo_url)
        studio_projects.update_project(
            user["uid"], workspace_id, {"github_repo_url": body.repo_url}
        )
    except FileNotFoundError as error:
        raise not_found(str(error)) from error
    except git_ops.GitUnavailableError as error:
        raise bad_request(str(error)) from error
    return StudioMessageResponse(ok=True, detail=f"Connected to {body.repo_url}")


@router.post("/push", response_model=StudioMessageResponse)
async def push_github(
    workspace_id: str,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    """Commit everything and push to the connected GitHub repo (uses stored OAuth token)."""
    require_non_serverless()
    commit = await asyncio.to_thread(
        git_ops.commit_all, user["uid"], workspace_id, "Sync from StarWaves Studio"
    )
    token = await asyncio.to_thread(_get_github_token, database, user["uid"])
    try:
        result = await asyncio.to_thread(git_ops.push, user["uid"], workspace_id, token)
    except git_ops.GitUnavailableError as error:
        raise bad_request(str(error)) from error
    detail = result["detail"]
    if not commit["committed"]:
        detail = f"{commit['detail']} {detail}".strip()
    return StudioMessageResponse(ok=True, detail=detail)
