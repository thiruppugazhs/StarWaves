"""Studio preview routes — single responsibility: preview URLs and static file serving."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Response
from app.db import SqlClient, get_firestore

from app.api.routes.studio._shared import require_non_serverless
from app.core.auth import get_current_user
from app.schemas.studio import StudioPreviewResponse
from app.services.studio import preview as studio_preview

router = APIRouter(prefix="/studio")


@router.post("/projects/{workspace_id}/preview", response_model=StudioPreviewResponse)
async def start_preview(
    workspace_id: str,
    user: dict = Depends(get_current_user),
    database: SqlClient = Depends(get_firestore),
):
    """Return a signed preview URL for the project (build output preferred)."""
    require_non_serverless()
    url_info = await asyncio.to_thread(
        studio_preview.build_preview_url, user["uid"], workspace_id
    )
    has_build = await asyncio.to_thread(
        studio_preview.has_build_output, user["uid"], workspace_id
    )
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
        raise HTTPException(status_code=403, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return Response(content=data, media_type=media_type)
