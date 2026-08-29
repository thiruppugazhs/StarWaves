import asyncio
import logging
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient, get_firestore
from itsdangerous import URLSafeTimedSerializer

from app.core.auth import get_current_user
from app.core.config import settings
from app.services.google_calendar import (
    google_calendar_data,
    google_state_serializer,
)
from app.services.oauth import (
    decrypt_google_token,
    encrypt_google_token,
    exchange_google_code,
    format_oauth_error,
    google_profile,
    integration_account_id,
    integration_accounts_reference,
    oauth_callback_html,
    refresh_google_token,
)
from app.services.oauth.google import build_google_authorize_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/google-calendar")

GOOGLE_CALENDAR_SCOPES = (
    "openid email profile "
    "https://www.googleapis.com/auth/calendar.readonly"
)


_calendar_cache: dict[str, tuple[float, dict]] = {}
_CALENDAR_TTL = 300  # 5 minutes

def _get_calendar_cached(user_id: str):
    import time
    e = _calendar_cache.get(user_id)
    if e and e[0] > time.monotonic():
        return e[1]
    return None

def _set_calendar_cached(user_id: str, data: dict):
    import time
    _calendar_cache[user_id] = (time.monotonic() + _CALENDAR_TTL, data)

def _invalidate_calendar_cache(user_id: str):
    _calendar_cache.pop(user_id, None)


def accounts_collection(database: SqlClient, user_id: str):
    return integration_accounts_reference(database, user_id, "google_calendar")


@router.get("/authorize")
def authorize_google_calendar(user: dict = Depends(get_current_user)):
    try:
        state = google_state_serializer().dumps({"uid": user["uid"]})
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from None
    url = build_google_authorize_url(
        settings.google_oauth_callback_url,
        GOOGLE_CALENDAR_SCOPES,
        state,
    )
    return {"url": url}


@router.get("/callback")
async def google_calendar_callback(
    code: str = Query(),
    state: str = Query(),
    database: SqlClient = Depends(get_firestore),
):
    try:
        user_id = google_state_serializer().loads(state, max_age=600)["uid"]
        token_data = await exchange_google_code(
            code,
            redirect_uri=settings.google_oauth_callback_url,
        )
        profile = await google_profile(token_data["access_token"])
        subject = profile["sub"]
        document = accounts_collection(database, user_id).document(
            integration_account_id(subject),
        )
        existing = document.get().to_dict() or {}
        refresh_token = token_data.get("refresh_token")
        encrypted_refresh_token = (
            encrypt_google_token(refresh_token)
            if refresh_token
            else existing.get("refresh_token")
        )
        if not encrypted_refresh_token:
            raise ValueError("Google did not return durable Calendar access.")
        calendar_data = await google_calendar_data(token_data["access_token"])
        await asyncio.to_thread(
            lambda: document.set(
                {
                    "subject": subject,
                    "email": profile["email"],
                    "name": profile.get("name") or profile["email"],
                    "picture": profile.get("picture", ""),
                    "refresh_token": encrypted_refresh_token,
                    "calendars": calendar_data["calendars"],
                    "updated_at": SERVER_TIMESTAMP,
                },
                merge=True,
            ),
        )
        _invalidate_calendar_cache(user_id)
    except Exception as error:
        logger.error("Google Calendar OAuth callback error: %s", error, exc_info=True)
        reason = quote(format_oauth_error(error))
        return oauth_callback_html(settings.frontend_url, "calendar", error_reason=reason)
    return oauth_callback_html(settings.frontend_url, "calendar")


@router.get("/data")
async def get_google_calendar_data(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
    force_refresh: bool = Query(default=False),
):
    if not force_refresh:
        cached = _get_calendar_cached(user["uid"])
        if cached is not None:
            return cached
    snapshots = await asyncio.to_thread(
        lambda: list(accounts_collection(database, user["uid"]).stream()),
    )
    if not snapshots:
        result = {"connections": [], "events": [], "errors": []}
        _set_calendar_cached(user["uid"], result)
        return result

    async def process_account(snapshot):
        account = snapshot.to_dict()
        encrypted_refresh = account.get("refresh_token")
        if not encrypted_refresh:
            raise ValueError(f"Missing refresh token for {account.get('email')}.")
        access_token = await refresh_google_token(
            decrypt_google_token(encrypted_refresh),
        )
        data = await google_calendar_data(access_token)
        # Update cache in background — don't block response on DB write
        try:
            await asyncio.to_thread(
                snapshot.reference.update,
                {
                    "calendars": data["calendars"],
                    "updated_at": SERVER_TIMESTAMP,
                },
            )
        except Exception:
            pass
        connection = {
            "id": snapshot.id,
            "email": account["email"],
            "name": account.get("name", account["email"]),
            "picture": account.get("picture", ""),
            "calendars": data["calendars"],
        }
        enriched_events = [
            {
                **event,
                "id": f"{snapshot.id}:{event['id']}",
                "accountEmail": account["email"],
            }
            for event in data["events"]
        ]
        return connection, enriched_events

    if len(snapshots) > 1:
        results = await asyncio.gather(
            *(process_account(s) for s in snapshots),
            return_exceptions=True,
        )
    else:
        try:
            results = [await process_account(s) for s in snapshots]
        except (KeyError, ValueError, httpx.HTTPError) as error:
            raise HTTPException(status_code=502, detail=str(error)) from None

    connections = []
    events = []
    errors = []
    for result in results:
        if isinstance(result, Exception):
            errors.append(str(result))
            continue
        connections.append(result[0])
        events.extend(result[1])

    result = {"connections": connections, "events": events, "errors": errors}
    _set_calendar_cached(user["uid"], result)
    return result


@router.delete("/accounts/{account_id}", status_code=204)
def disconnect_google_calendar(
    account_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    accounts_collection(database, user["uid"]).document(account_id).delete()
    _invalidate_calendar_cache(user["uid"])
