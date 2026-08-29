import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.config import settings
from app.repositories import contacts as contacts_repo
from app.schemas.contact import ContactCreate
from app.services.google_contacts import (
    GOOGLE_CONTACTS_SCOPES,
    fetch_google_people_connections,
    google_contacts_state_serializer,
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

router = APIRouter(prefix="/integrations/google-contacts")


def accounts_collection(database: SqlClient, user_id: str):
    return integration_accounts_reference(database, user_id, "google_contacts")


@router.get("/authorize")
def authorize_google_contacts(user: dict = Depends(get_current_user)):
    try:
        state = google_contacts_state_serializer().dumps({"uid": user["uid"]})
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from None
    url = build_google_authorize_url(
        settings.google_contacts_oauth_callback_url,
        GOOGLE_CONTACTS_SCOPES,
        state,
    )
    return {"url": url}


@router.get("/callback")
async def google_contacts_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    database: SqlClient = Depends(get_firestore),
):
    if error or not code or not state:
        reason = error or "Authorization code or state was missing."
        return oauth_callback_html(settings.frontend_url, "google-contacts", reason)

    try:
        token_payload = google_contacts_state_serializer().loads(state, max_age=600)
    except Exception:
        return oauth_callback_html(
            settings.frontend_url,
            "google-contacts",
            "State token is invalid or expired.",
        )

    user_uid = token_payload.get("uid")
    if not user_uid:
        return oauth_callback_html(
            settings.frontend_url,
            "google-contacts",
            "User state token was invalid.",
        )

    try:
        token_data = await exchange_google_code(
            code,
            redirect_uri=settings.google_contacts_oauth_callback_url,
        )
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
        profile = await google_profile(access_token)
        account_email = profile.get("email") or ""
        doc_id = integration_account_id(account_email or user_uid)

        update_payload: dict[str, Any] = {
            "email": account_email,
            "name": profile.get("name") or "",
            "avatar_url": profile.get("picture"),
            "access_token": encrypt_google_token(access_token),
            "updated_at": SERVER_TIMESTAMP,
        }
        if refresh_token:
            update_payload["refresh_token"] = encrypt_google_token(refresh_token)

        accounts_collection(database, user_uid).document(doc_id).set(
            update_payload,
            merge=True,
        )
        return oauth_callback_html(settings.frontend_url, "google-contacts")
    except Exception as exc:
        logger.warning("Google Contacts callback failed for user %s: %s", user_uid, exc)
        return oauth_callback_html(
            settings.frontend_url,
            "google-contacts",
            format_oauth_error(exc, "Google Contacts"),
        )


@router.get("/accounts")
async def get_google_contacts_accounts(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    import asyncio
    docs = await asyncio.to_thread(lambda: list(accounts_collection(database, user["uid"]).stream()))
    accounts = []
    for doc in docs:
        data = doc.to_dict() or {}
        accounts.append({
            "id": doc.id,
            "email": data.get("email"),
            "name": data.get("name"),
            "avatar_url": data.get("avatar_url"),
        })
    return {"accounts": accounts}


@router.post("/import")
async def import_google_contacts(
    account_id: str | None = Query(None),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    user_uid = user["uid"]
    collection_ref = accounts_collection(database, user_uid)

    if account_id:
        doc = collection_ref.document(account_id).get()
    else:
        docs = list(collection_ref.limit(1).stream())
        doc = docs[0] if docs else None

    if not doc or not doc.exists:
        raise HTTPException(
            status_code=400,
            detail="No connected Google account found. Please connect Google Contacts first.",
        )

    account_data = doc.to_dict() or {}
    enc_access = account_data.get("access_token")
    enc_refresh = account_data.get("refresh_token")

    if not enc_access:
        raise HTTPException(
            status_code=400,
            detail="Google account is missing access credentials.",
        )

    import httpx

    access_token = decrypt_google_token(enc_access)
    try:
        raw_contacts = await fetch_google_people_connections(access_token)
    except Exception as initial_err:
        # If token was expired (401), attempt refresh
        is_401 = isinstance(initial_err, httpx.HTTPStatusError) and initial_err.response.status_code == 401
        is_403 = isinstance(initial_err, httpx.HTTPStatusError) and initial_err.response.status_code == 403

        if is_403:
            google_msg = ""
            try:
                err_data = initial_err.response.json()
                google_msg = err_data.get("error", {}).get("message", "")
            except Exception:
                google_msg = str(initial_err)

            logger.warning("Google People API 403 Forbidden: %s", google_msg)
            if "People API has not been used" in google_msg or "disabled" in google_msg.lower():
                detail = (
                    "Google People API is not enabled in your Google Cloud Console. "
                    "Please enable 'People API' at https://console.cloud.google.com/apis/library/people.googleapis.com and retry."
                )
            elif "scope" in google_msg.lower() or "permission" in google_msg.lower():
                detail = (
                    "Google Contacts permission was not granted. "
                    "Please reconnect your Google account and grant Contacts access."
                )
            else:
                detail = f"Google People API access denied (403): {google_msg or initial_err}"

            raise HTTPException(status_code=403, detail=detail) from None

        if enc_refresh and (is_401 or not isinstance(initial_err, httpx.HTTPStatusError)):
            try:
                refresh_token = decrypt_google_token(enc_refresh)
                access_token = await refresh_google_token(refresh_token)
                doc.reference.update({
                    "access_token": encrypt_google_token(access_token),
                    "updated_at": SERVER_TIMESTAMP,
                })
                raw_contacts = await fetch_google_people_connections(access_token)
            except Exception as refresh_err:
                logger.warning("Token refresh or retry failed during Google Contacts import: %s", refresh_err)
                if isinstance(refresh_err, httpx.HTTPStatusError) and refresh_err.response.status_code == 403:
                    try:
                        err_data = refresh_err.response.json()
                        google_msg = err_data.get("error", {}).get("message", "")
                    except Exception:
                        google_msg = str(refresh_err)
                    raise HTTPException(
                        status_code=403,
                        detail=f"Google People API access denied (403): {google_msg or 'Enable Google People API in Google Cloud Console.'}",
                    ) from None
                raise HTTPException(
                    status_code=401,
                    detail="Google Contacts session expired. Please reconnect your Google account.",
                ) from None
        else:
            raise HTTPException(
                status_code=401,
                detail=f"Could not load contacts from Google: {initial_err}",
            ) from None

    # Existing contacts for deduplication
    existing_contacts = contacts_repo.list_contacts(database, user_uid)
    existing_emails = {c.email.lower().strip() for c in existing_contacts if c.email}
    existing_phones = {c.phone.replace(" ", "").replace("-", "").strip() for c in existing_contacts if c.phone}
    existing_names = {c.name.lower().strip() for c in existing_contacts if c.name}

    imported_count = 0
    now = datetime.now(timezone.utc).isoformat()
    contacts_collection = contacts_repo.collection(database, user_uid)

    for item in raw_contacts:
        email_clean = (item.get("email") or "").lower().strip()
        phone_clean = (item.get("phone") or "").replace(" ", "").replace("-", "").strip()
        name_clean = (item.get("name") or "").lower().strip()

        # Check duplicate
        if email_clean and email_clean in existing_emails:
            continue
        if phone_clean and phone_clean in existing_phones:
            continue
        if not email_clean and not phone_clean and name_clean in existing_names:
            continue

        # Save new contact
        contact_model = ContactCreate(
            name=item.get("name") or "Unnamed Contact",
            email=item.get("email"),
            phone=item.get("phone"),
            company=item.get("company"),
            role=item.get("role"),
            category=item.get("category", "general"),
            notes=item.get("notes"),
            avatar_url=item.get("avatar_url"),
            starred=False,
        )
        data = contact_model.model_dump(mode="python")
        new_ref = contacts_collection.document()
        new_ref.set({
            **data,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        })

        if email_clean:
            existing_emails.add(email_clean)
        if phone_clean:
            existing_phones.add(phone_clean)
        if name_clean:
            existing_names.add(name_clean)
        imported_count += 1

    return {
        "imported_count": imported_count,
        "total_found": len(raw_contacts),
    }


@router.post("/disconnect")
async def disconnect_google_contacts(
    account_id: str | None = Query(None),
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    import asyncio
    coll = accounts_collection(database, user["uid"])
    if account_id:
        await asyncio.to_thread(coll.document(account_id).delete)
    else:
        docs = await asyncio.to_thread(lambda: list(coll.stream()))
        for doc in docs:
            await asyncio.to_thread(doc.reference.delete)
    return {"status": "disconnected"}
