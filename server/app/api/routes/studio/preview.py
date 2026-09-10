"""Studio preview routes — single responsibility: preview URLs and static file serving."""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from app.db import SqlClient, get_firestore

from app.api.routes.studio._shared import not_found, require_non_serverless
from app.core.auth import get_current_user
from app.core.errors import bad_request, forbidden, not_found
from app.schemas.studio import StudioPreviewResponse
from app.services.studio import preview as studio_preview
from app.repositories import studio as studio_repo

router = APIRouter(prefix="/studio")


@router.post("/projects/{workspace_id}/preview", response_model=StudioPreviewResponse)
async def start_preview(
    workspace_id: str,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    """Return a signed preview URL for the project (build output preferred)."""
    require_non_serverless()
    try:
        await asyncio.to_thread(
            studio_repo.get_studio_project, user["uid"], workspace_id
        )
    except FileNotFoundError as error:
        raise not_found(f"Studio project '{workspace_id}' not found.") from error

    url_info = await asyncio.to_thread(
        studio_preview.build_preview_url, user["uid"], workspace_id
    )
    has_build = await asyncio.to_thread(
        studio_preview.has_build_output, user["uid"], workspace_id
    )
    try:
        await asyncio.to_thread(
            studio_repo.update_studio_project,
            user["uid"],
            workspace_id,
            {
                "preview_status": "ready" if has_build else "unavailable",
                "last_activity": {
                    "type": "preview_started",
                    "label": "Preview opened",
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                },
            },
        )
    except FileNotFoundError as error:
        raise not_found(f"Studio project '{workspace_id}' not found.") from error
    return StudioPreviewResponse(
        preview_url=url_info["preview_url"],
        has_build_output=has_build,
    )


@router.get("/preview/{token}/{file_path:path}", include_in_schema=False)
@router.get("/preview/{token}", include_in_schema=False)
async def serve_preview(token: str, file_path: str = ""):
    """Serve studio project files for a signed preview token (no bearer auth).

    The token itself is the credential — read-only, scoped to one workspace,
    expiring after a week. HTML runs inside a sandboxed iframe on the client.
    """
    try:
        user_id, workspace_id = studio_preview.resolve_preview_token(token)
        data, media_type = await asyncio.to_thread(
            studio_preview.read_preview_file, user_id, workspace_id, file_path
        )
    except studio_preview.PreviewTokenError as error:
        raise forbidden(str(error)) from error
    except FileNotFoundError as error:
        raise not_found(str(error)) from error
    except ValueError as error:
        raise bad_request(str(error)) from error
    return Response(content=data, media_type=media_type)
