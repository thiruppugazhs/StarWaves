import asyncio
import logging
from urllib.parse import quote, unquote

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient, get_firestore
from itsdangerous import URLSafeTimedSerializer

from app.core.auth import get_current_user
from app.core.config import settings
from app.services.oauth import (
    decrypt_google_token,
    encrypt_google_token,
    exchange_google_code,
    format_oauth_error,
    google_oauth_state_serializer,
    google_profile,
    oauth_callback_html,
    refresh_google_token,
)
from app.services.oauth.google import build_google_authorize_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/google-drive")

GOOGLE_DRIVE_SCOPES = (
    "openid email profile "
    "https://www.googleapis.com/auth/drive.metadata.readonly "
    "https://www.googleapis.com/auth/drive.file"
)


def drive_reference(database: SqlClient, user_id: str):
    return (
        database.collection("users")
        .document(user_id)
        .collection("integrations")
        .document("google_drive")
    )


def drive_state_serializer() -> URLSafeTimedSerializer:
    return google_oauth_state_serializer("starwaves-google-drive-oauth")


_drive_token_cache: dict[str, tuple[float, str]] = {}
_DRIVE_TOKEN_TTL = 3000

async def access_token(database: SqlClient, user_id: str) -> str:
    import time
    cached = _drive_token_cache.get(user_id)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    snapshot = await asyncio.to_thread(drive_reference(database, user_id).get)
    if not snapshot.exists:
        raise HTTPException(status_code=409, detail="Connect Google Drive first.")
    try:
        refresh_token = decrypt_google_token(snapshot.to_dict()["refresh_token"])
        token = await refresh_google_token(refresh_token)
        _drive_token_cache[user_id] = (time.monotonic() + _DRIVE_TOKEN_TTL, token)
        return token
    except (KeyError, ValueError, httpx.HTTPError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from None


@router.get("/authorize")
def authorize_google_drive(user: dict = Depends(get_current_user)):
    try:
        state = drive_state_serializer().dumps({"uid": user["uid"]})
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from None
    url = build_google_authorize_url(
        settings.google_drive_oauth_callback_url,
        GOOGLE_DRIVE_SCOPES,
        state,
    )
    return {"url": url}


@router.get("/callback")
async def google_drive_callback(
    code: str = Query(),
    state: str = Query(),
    database: SqlClient = Depends(get_firestore),
):
    try:
        user_id = drive_state_serializer().loads(state, max_age=600)["uid"]
        token_data = await exchange_google_code(
            code,
            redirect_uri=settings.google_drive_oauth_callback_url,
        )
        profile = await google_profile(token_data["access_token"])
        existing = (await asyncio.to_thread(drive_reference(database, user_id).get)).to_dict() or {}
        refresh_token = token_data.get("refresh_token")
        encrypted_refresh_token = (
            encrypt_google_token(refresh_token)
            if refresh_token
            else existing.get("refresh_token")
        )
        if not encrypted_refresh_token:
            raise ValueError("Google did not return durable Drive access.")
        await asyncio.to_thread(
            lambda: drive_reference(database, user_id).set(
                {
                    "subject": profile["sub"],
                    "email": profile["email"],
                    "name": profile.get("name") or profile["email"],
                    "picture": profile.get("picture", ""),
                    "refresh_token": encrypted_refresh_token,
                    "updated_at": SERVER_TIMESTAMP,
                },
                merge=True,
            ),
        )
        _drive_cache_invalidate(user_id)
    except Exception as error:
        logger.error("Google Drive OAuth callback error: %s", error, exc_info=True)
        reason = quote(format_oauth_error(error))
        return oauth_callback_html(settings.frontend_url, "drive", error_reason=reason)
    return oauth_callback_html(settings.frontend_url, "drive")


_drive_status_cache: dict[str, tuple[float, dict]] = {}
_DRIVE_TTL = 30

def _drive_cache_get(uid: str):
    import time
    e = _drive_status_cache.get(uid)
    if e and e[0] > time.monotonic():
        return e[1]
    return None

def _drive_cache_set(uid: str, data: dict):
    import time
    _drive_status_cache[uid] = (time.monotonic() + _DRIVE_TTL, data)

def _drive_cache_invalidate(uid: str):
    _drive_status_cache.pop(uid, None)
    _drive_token_cache.pop(uid, None)


@router.get("/status")
async def google_drive_status(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    cached = _drive_cache_get(user["uid"])
    if cached is not None:
        return cached
    snapshot = await asyncio.to_thread(drive_reference(database, user["uid"]).get)
    if not snapshot.exists:
        result = {"connected": False, "account": None}
        _drive_cache_set(user["uid"], result)
        return result
    account = snapshot.to_dict()
    result = {
        "connected": True,
        "account": {
            "email": account["email"],
            "name": account.get("name", account["email"]),
            "picture": account.get("picture", ""),
        },
    }
    _drive_cache_set(user["uid"], result)
    return result


@router.get("/files")
async def google_drive_files(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    token = await access_token(database, user["uid"])
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "pageSize": "100",
                "orderBy": "modifiedTime desc",
                "q": "trashed = false",
                "fields": "files(id,name,mimeType,size,modifiedTime,webViewLink)",
            },
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise HTTPException(status_code=502, detail=response.text) from error
        return response.json()


@router.get("/editor-url/{document_id}")
async def google_drive_editor_url(
    document_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    if "/" in document_id or not document_id.strip():
        raise HTTPException(status_code=400, detail="Invalid document ID.")

    document_reference = database.collection("users").document(user["uid"]).collection("documents").document(document_id)
    snapshot = await asyncio.to_thread(document_reference.get)
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Document not found.")
    document = snapshot.to_dict() or {}
    drive_file_id = document.get("drive_file_id")
    if not drive_file_id:
        raise HTTPException(status_code=409, detail="This document is not linked to Google Drive.")

    token = await access_token(database, user["uid"])
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{quote(drive_file_id, safe='')}",
            headers={"Authorization": f"Bearer {token}"},
            params={"fields": "id,name,mimeType,webViewLink"},
        )
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="The Google Drive file no longer exists.")
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail="Google Drive could not open this file.") from error

    file = response.json()
    editor_hosts = {
        "application/vnd.google-apps.document": "https://docs.google.com/document/d/{id}/edit",
        "application/vnd.google-apps.spreadsheet": "https://docs.google.com/spreadsheets/d/{id}/edit",
        "application/vnd.google-apps.presentation": "https://docs.google.com/presentation/d/{id}/edit",
    }
    editor_template = editor_hosts.get(file.get("mimeType"))
    if not editor_template:
        raise HTTPException(status_code=409, detail="This file type does not have a Google Workspace editor.")
    return {
        "id": file["id"],
        "name": file.get("name", document.get("name", "Untitled document")),
        "mime_type": file.get("mimeType"),
        "editor_url": editor_template.format(id=quote(file["id"], safe="")),
    }


@router.post("/upload")
async def upload_google_drive_file(
    request: Request,
    x_file_name: str = Header(),
    x_file_type: str = Header(default="application/octet-stream"),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    token = await access_token(database, user["uid"])
    content = await request.body()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=120) as client:
        metadata_response = await client.post(
            "https://www.googleapis.com/upload/drive/v3/files",
            headers={
                **headers,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": x_file_type,
                "X-Upload-Content-Length": str(len(content)),
            },
            params={
                "uploadType": "resumable",
                "fields": "id,name,mimeType,size,modifiedTime,webViewLink",
            },
            json={"name": unquote(x_file_name)},
        )
        try:
            metadata_response.raise_for_status()
            upload_url = metadata_response.headers["Location"]
            upload_response = await client.put(
                upload_url,
                headers={"Content-Type": x_file_type},
                content=content,
            )
            upload_response.raise_for_status()
        except (httpx.HTTPStatusError, KeyError) as error:
            raise HTTPException(
                status_code=502,
                detail="Google Drive upload failed.",
            ) from error
        return upload_response.json()


@router.delete("", status_code=204)
def disconnect_google_drive(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    drive_reference(database, user["uid"]).delete()
    _drive_cache_invalidate(user["uid"])
