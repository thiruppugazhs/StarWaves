import asyncio
import logging
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient, get_firestore
from itsdangerous import URLSafeTimedSerializer
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.config import settings
from app.services.oauth import (
    decrypt_google_token,
    encrypt_google_token,
    exchange_google_code,
    format_oauth_error,
    google_oauth_state_serializer,
    integration_account_id,
    integration_accounts_reference,
    oauth_callback_html,
    refresh_google_token,
)
from app.services.oauth.google import build_google_authorize_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/gmail")

GMAIL_SCOPES = (
    "openid email profile "
    "https://www.googleapis.com/auth/gmail.modify "
    "https://www.googleapis.com/auth/gmail.readonly "
    "https://www.googleapis.com/auth/gmail.send"
)


class GmailConnection(BaseModel):
    access_token: str = Field(min_length=1)


def gmail_accounts_collection(database: SqlClient, user_id: str):
    return integration_accounts_reference(database, user_id, "gmail")


def gmail_state_serializer() -> URLSafeTimedSerializer:
    return google_oauth_state_serializer("starwaves-gmail-oauth")


@router.get("/authorize")
def authorize_gmail(user: dict = Depends(get_current_user)):
    try:
        state = gmail_state_serializer().dumps({"uid": user["uid"]})
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from None
    url = build_google_authorize_url(
        settings.gmail_oauth_callback_url,
        GMAIL_SCOPES,
        state,
    )
    return {"url": url}


@router.get("/callback")
async def gmail_callback(
    code: str = Query(...),
    state: str = Query(...),
    database: SqlClient = Depends(get_firestore),
):
    try:
        user_id = gmail_state_serializer().loads(state, max_age=600)["uid"]
        token_data = await exchange_google_code(
            code,
            redirect_uri=settings.gmail_oauth_callback_url,
        )
        async with httpx.AsyncClient(timeout=20) as client:
            profile_res = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
            profile_res.raise_for_status()
            email = profile_res.json()["emailAddress"]

        doc_id = integration_account_id(email)
        doc_ref = gmail_accounts_collection(database, user_id).document(doc_id)
        existing = (await asyncio.to_thread(doc_ref.get)).to_dict() or {}
        refresh_token = token_data.get("refresh_token")
        encrypted_refresh_token = (
            encrypt_google_token(refresh_token)
            if refresh_token
            else existing.get("refresh_token")
        )

        await asyncio.to_thread(
            lambda: doc_ref.set(
                {
                    "id": doc_id,
                    "email": email,
                    "connected": True,
                    "access_token": token_data["access_token"],
                    "refresh_token": encrypted_refresh_token,
                    "refreshable": True,
                    "updated_at": SERVER_TIMESTAMP,
                },
                merge=True,
            ),
        )
        _invalidate_gmail_cache(user_id)
    except Exception as error:
        logger.error("Gmail OAuth callback error: %s", error, exc_info=True)
        reason = quote(format_oauth_error(error))
        return oauth_callback_html(settings.frontend_url, "gmail", error_reason=reason)
    return oauth_callback_html(settings.frontend_url, "gmail")


@router.post("")
@router.post("/accounts")
async def connect_gmail(
    connection: GmailConnection,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/profile",
            headers={"Authorization": f"Bearer {connection.access_token}"},
        )
    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=400,
            detail="Google rejected the Gmail authorization.",
        )
    try:
        response.raise_for_status()
        profile = response.json()
        email = profile["emailAddress"]
    except (httpx.HTTPError, KeyError, ValueError) as error:
        raise HTTPException(
            status_code=502,
            detail="Gmail account verification failed.",
        ) from error

    doc_id = integration_account_id(email)
    doc_ref = gmail_accounts_collection(database, user["uid"]).document(doc_id)
    await asyncio.to_thread(
        lambda: doc_ref.set(
            {
                "id": doc_id,
                "email": email,
                "connected": True,
                "access_token": connection.access_token,
                "refreshable": False,
                "updated_at": SERVER_TIMESTAMP,
            },
            merge=True,
        ),
    )
    _invalidate_gmail_cache(user["uid"])
    return {
        "connected": True,
        "account": {"id": doc_id, "email": email},
        "refreshable": False,
    }


_gmail_cache: dict[str, tuple[float, dict]] = {}
_GMAIL_CACHE_TTL = 30  # seconds
_gmail_token_cache: dict[str, tuple[float, dict]] = {}
_GMAIL_TOKEN_TTL = 3000  # ~50 minutes

def _get_cached_gmail_status(user_id: str):
    import time
    entry = _gmail_cache.get(user_id)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    return None

def _set_cached_gmail_status(user_id: str, data: dict):
    import time
    _gmail_cache[user_id] = (time.monotonic() + _GMAIL_CACHE_TTL, data)

def _invalidate_gmail_cache(user_id: str):
    _gmail_cache.pop(user_id, None)
    # remove token cache entries for user
    for key in list(_gmail_token_cache.keys()):
        if key.startswith(user_id + ":"):
            _gmail_token_cache.pop(key, None)


@router.get("/token")
async def get_gmail_token(
    email: str | None = Query(default=None),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    """Return a fresh Gmail access token for the given account (or first account)."""
    cache_key = f"{user['uid']}:{email or ''}"
    import time as _time
    cached = _gmail_token_cache.get(cache_key)
    if cached and cached[0] > _time.monotonic():
        return cached[1]
    collection = gmail_accounts_collection(database, user["uid"])
    if email:
        doc_id = integration_account_id(email)
        snapshot = await asyncio.to_thread(collection.document(doc_id).get)
        if not snapshot.exists:
            raise HTTPException(status_code=404, detail="Gmail account not found.")
        data = snapshot.to_dict()
    else:
        snapshots = await asyncio.to_thread(lambda: list(collection.stream()))
        if not snapshots:
            raise HTTPException(status_code=404, detail="No Gmail accounts connected.")
        data = snapshots[0].to_dict()

    encrypted_refresh_token = data.get("refresh_token")
    if not encrypted_refresh_token:
        stored_access_token = data.get("access_token")
        if stored_access_token:
            result = {
                "email": data.get("email", ""),
                "access_token": stored_access_token,
                "expires_in": 3599,
                "refreshable": False,
            }
            _gmail_token_cache[cache_key] = (_time.monotonic() + _GMAIL_TOKEN_TTL, result)
            return result
        raise HTTPException(
            status_code=400,
            detail="No refresh token stored for this Gmail account. Please reconnect via the OAuth flow.",
        )

    try:
        refresh_token = decrypt_google_token(encrypted_refresh_token)
        access_token = await refresh_google_token(refresh_token)
    except Exception as error:
        logger.error("Gmail token refresh failed: %s", error, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="Could not refresh Gmail access token. Please reconnect your account.",
        ) from error

    result = {
        "email": data.get("email", ""),
        "access_token": access_token,
        "expires_in": 3599,
    }
    _gmail_token_cache[cache_key] = (_time.monotonic() + _GMAIL_TOKEN_TTL, result)
    return result


@router.get("/accounts")
async def get_gmail_accounts(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    snapshots = await asyncio.to_thread(lambda: list(gmail_accounts_collection(database, user["uid"]).stream()))
    accounts = []
    for snapshot in snapshots:
        data = snapshot.to_dict()
        accounts.append({
            "id": snapshot.id,
            "email": data.get("email", ""),
            "connected": bool(data.get("connected", True)),
        })
    return {"accounts": accounts}


@router.get("/status")
async def gmail_status(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    cached = _get_cached_gmail_status(user["uid"])
    if cached is not None:
        return cached
    snapshots = await asyncio.to_thread(lambda: list(gmail_accounts_collection(database, user["uid"]).stream()))
    accounts = []
    for snapshot in snapshots:
        data = snapshot.to_dict()
        accounts.append({
            "id": snapshot.id,
            "email": data.get("email", ""),
            "connected": bool(data.get("connected", True)),
        })

    connected = len(accounts) > 0
    primary_account = accounts[0] if accounts else None
    result = {
        "connected": connected,
        "account": primary_account,
        "accounts": accounts,
    }
    _set_cached_gmail_status(user["uid"], result)
    return result


@router.delete("/accounts/{account_id}", status_code=204)
def disconnect_gmail_account(
    account_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    gmail_accounts_collection(database, user["uid"]).document(account_id).delete()
    _invalidate_gmail_cache(user["uid"])


@router.delete("", status_code=204)
async def disconnect_all_gmail(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    collection = gmail_accounts_collection(database, user["uid"])
    snapshots = await asyncio.to_thread(lambda: list(collection.stream()))
    if snapshots:
        batch = database.batch()
        for snapshot in snapshots:
            batch.delete(snapshot.reference)
        await asyncio.to_thread(batch.commit)
    _invalidate_gmail_cache(user["uid"])
