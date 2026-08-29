import asyncio
import logging
import uuid
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

router = APIRouter(prefix="/integrations/google-chat")

GOOGLE_CHAT_SCOPES = (
    "openid email profile "
    "https://www.googleapis.com/auth/chat.spaces.readonly "
    "https://www.googleapis.com/auth/chat.messages "
    "https://www.googleapis.com/auth/chat.memberships.readonly"
)


async def resolve_chat_access_token(account: dict) -> str | None:
    """Return a usable Google Chat access token for an account.

    Prefers refreshing from the stored encrypted refresh token; falls back to
    the last stored raw access token for token-connect accounts.
    """
    encrypted_refresh = account.get("refresh_token")
    if encrypted_refresh:
        try:
            refresh_token = decrypt_google_token(encrypted_refresh)
            return await refresh_google_token(refresh_token)
        except Exception as error:
            logger.warning(
                "Google Chat token refresh failed for %s: %s",
                account.get("email"),
                error,
            )
    return account.get("access_token")


class GoogleChatConnection(BaseModel):
    access_token: str = Field(min_length=1)


class GoogleChatMessageSend(BaseModel):
    space_id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    account_email: str | None = None


def chat_accounts_collection(database: SqlClient, user_id: str):
    return integration_accounts_reference(database, user_id, "google_chat")


def chat_state_serializer() -> URLSafeTimedSerializer:
    return google_oauth_state_serializer("starwaves-google-chat-oauth")


@router.get("/authorize")
def authorize_google_chat(user: dict = Depends(get_current_user)):
    try:
        state = chat_state_serializer().dumps({"uid": user["uid"]})
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from None
    url = build_google_authorize_url(
        settings.google_chat_oauth_callback_url,
        GOOGLE_CHAT_SCOPES,
        state,
    )
    return {"url": url}


@router.get("/callback")
async def google_chat_callback(
    code: str = Query(...),
    state: str = Query(...),
    database: SqlClient = Depends(get_firestore),
):
    try:
        user_id = chat_state_serializer().loads(state, max_age=600)["uid"]
        token_data = await exchange_google_code(
            code,
            redirect_uri=settings.google_chat_oauth_callback_url,
        )
        async with httpx.AsyncClient(timeout=20) as client:
            userinfo_res = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
            userinfo_res.raise_for_status()
            userinfo = userinfo_res.json()
            email = userinfo.get("email")
            display_name = userinfo.get("name", email)
            picture = userinfo.get("picture")

        if not email:
            raise ValueError("Google account email could not be retrieved.")

        doc_id = integration_account_id(email)
        doc_ref = chat_accounts_collection(database, user_id).document(doc_id)
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
                    "display_name": display_name,
                    "picture": picture,
                    "connected": True,
                    "access_token": token_data["access_token"],
                    "refresh_token": encrypted_refresh_token,
                    "updated_at": SERVER_TIMESTAMP,
                },
                merge=True,
            ),
        )
    except Exception as error:
        logger.error("Google Chat OAuth callback error: %s", error, exc_info=True)
        reason = quote(format_oauth_error(error))
        return oauth_callback_html(settings.frontend_url, "chat", error_reason=reason)
    return oauth_callback_html(settings.frontend_url, "chat")


@router.get("/accounts")
def get_google_chat_accounts(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    docs = chat_accounts_collection(database, user["uid"]).stream()
    accounts = []
    for doc in docs:
        data = doc.to_dict() or {}
        if data.get("connected"):
            accounts.append(
                {
                    "id": data.get("id", doc.id),
                    "email": data.get("email"),
                    "display_name": data.get("display_name"),
                    "picture": data.get("picture"),
                    "connected": True,
                }
            )
    return {"accounts": accounts}


@router.post("/accounts")
async def connect_google_chat_account(
    connection: GoogleChatConnection,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {connection.access_token}"},
        )
    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=400,
            detail="Google rejected the Google Chat authorization.",
        )
    try:
        response.raise_for_status()
        userinfo = response.json()
        email = userinfo["email"]
        display_name = userinfo.get("name", email)
        picture = userinfo.get("picture")
    except (httpx.HTTPError, KeyError, ValueError) as error:
        raise HTTPException(
            status_code=502,
            detail="Google Chat account verification failed.",
        ) from error

    doc_id = integration_account_id(email)
    doc_ref = chat_accounts_collection(database, user["uid"]).document(doc_id)
    await asyncio.to_thread(
        lambda: doc_ref.set(
            {
                "id": doc_id,
                "email": email,
                "display_name": display_name,
                "picture": picture,
                "connected": True,
                "access_token": connection.access_token,
                "updated_at": SERVER_TIMESTAMP,
            },
            merge=True,
        ),
    )
    return {
        "connected": True,
        "account": {
            "id": doc_id,
            "email": email,
            "display_name": display_name,
            "picture": picture,
        },
    }


@router.delete("/accounts/{account_id}")
def disconnect_google_chat_account(
    account_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    doc_ref = chat_accounts_collection(database, user["uid"]).document(account_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Account connection not found.")
    doc_ref.delete()
    return {"disconnected": True}


@router.get("/spaces")
async def get_google_chat_spaces(
    account_email: str | None = None,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    docs = await asyncio.to_thread(
        lambda: list(chat_accounts_collection(database, user["uid"]).stream()),
    )
    accounts = [doc.to_dict() for doc in docs if doc.to_dict().get("connected")]
    if account_email:
        accounts = [a for a in accounts if a.get("email") == account_email]

    async def fetch_space_messages(client, space_name, token, email, acc):
        msgs = []
        try:
            msgs_res = await client.get(
                f"https://chat.googleapis.com/v1/{space_name}/messages?pageSize=20",
                headers={"Authorization": f"Bearer {token}"},
            )
            if msgs_res.status_code == 200:
                raw_msgs = msgs_res.json().get("messages", [])
                for m in raw_msgs:
                    sender_info = m.get("sender", {})
                    sender_name = sender_info.get(
                        "displayName",
                        "User",
                    )
                    avatar = "".join(
                        [part[0] for part in sender_name.split()[:2]]
                    ).upper() or "GC"
                    msgs.append(
                        {
                            "id": m.get("name", f"msg-{uuid.uuid4().hex[:8]}"),
                            "sender": sender_name,
                            "senderEmail": sender_info.get(
                                "name",
                                email,
                            ),
                            "avatar": avatar,
                            "time": m.get("createTime", "")[:16].replace(
                                "T", " "
                            ),
                            "content": m.get("text", ""),
                            "isSelf": sender_name == acc.get("display_name"),
                        }
                    )
        except Exception as e:
            logger.warning(
                "Error fetching messages for space %s: %s",
                space_name,
                e,
            )
        return msgs

    all_spaces = []
    async with httpx.AsyncClient(timeout=15) as client:
        for acc in accounts:
            token = await resolve_chat_access_token(acc)
            email = acc.get("email")
            if not token:
                continue

            try:
                spaces_res = await client.get(
                    "https://chat.googleapis.com/v1/spaces",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if spaces_res.status_code == 200:
                    data = spaces_res.json()
                    raw_spaces = data.get("spaces", [])

                    # Fetch messages for all spaces concurrently
                    message_tasks = [
                        fetch_space_messages(client, s.get("name"), token, email, acc)
                        for s in raw_spaces
                    ]
                    all_msgs = await asyncio.gather(*message_tasks)

                    for s, msgs in zip(raw_spaces, all_msgs):
                        space_name = s.get("name")
                        display_name = s.get("displayName") or "Direct Message"
                        space_type = (
                            "space"
                            if s.get("spaceType") in ("SPACE", "GROUP_CHAT")
                            else "dm"
                        )

                        last_msg = msgs[-1]["content"] if msgs else "No messages yet."
                        last_time = msgs[-1]["time"] if msgs else ""
                        members_count = s.get("membershipCount")

                        all_spaces.append(
                            {
                                "id": space_name,
                                "name": display_name,
                                "type": space_type,
                                "accountEmail": email,
                                "accountName": acc.get("display_name", email),
                                "lastMessage": last_msg,
                                "lastTime": last_time,
                                "membersCount": (
                                    members_count if members_count else None
                                ),
                                "isPrivate": space_type == "dm",
                                "messages": msgs,
                            }
                        )
            except Exception as error:
                logger.warning(
                    "Google Chat API call error for account %s: %s",
                    email,
                    error,
                )

    return {
        "accounts": [
            {
                "id": a.get("id"),
                "email": a.get("email"),
                "display_name": a.get("display_name"),
            }
            for a in accounts
        ],
        "spaces": all_spaces,
    }


@router.post("/messages")
async def send_google_chat_message(
    body: GoogleChatMessageSend,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    docs = await asyncio.to_thread(
        lambda: list(chat_accounts_collection(database, user["uid"]).stream()),
    )
    accounts = [doc.to_dict() for doc in docs if doc.to_dict().get("connected")]
    if body.account_email:
        accounts = [a for a in accounts if a.get("email") == body.account_email]

    if not accounts:
        raise HTTPException(
            status_code=404,
            detail="No connected Google Chat account found for message sending.",
        )

    account = accounts[0]
    token = await resolve_chat_access_token(account)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Account access token is missing.",
        )

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"https://chat.googleapis.com/v1/{body.space_id}/messages",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"text": body.text},
        )
        if not res.is_success:
            raise HTTPException(
                status_code=res.status_code,
                detail=f"Google Chat API rejected message: {res.text}",
            )
        return res.json()
