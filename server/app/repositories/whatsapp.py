from datetime import datetime, timezone
from typing import Any, List, Optional
from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

from app.schemas.whatsapp import (
    WhatsAppChatResponse,
    WhatsAppMediaAttachment,
    WhatsAppMessageResponse,
    WhatsAppSettings,
    WhatsAppStatusResponse,
)


def _chats_col(database: SqlClient, user_id: str):
    return database.collection("users").document(user_id).collection("whatsapp_chats")


def _messages_col(database: SqlClient, user_id: str, chat_id: str):
    return _chats_col(database, user_id).document(chat_id).collection("messages")


def _session_doc(database: SqlClient, user_id: str):
    return database.collection("users").document(user_id).collection("whatsapp_session").document("default")


def _settings_doc(database: SqlClient, user_id: str):
    return database.collection("users").document(user_id).collection("whatsapp_settings").document("default")


def get_whatsapp_status(database: SqlClient, user_id: str) -> WhatsAppStatusResponse:
    snap = _session_doc(database, user_id).get()
    settings_snap = _settings_doc(database, user_id).get()
    auto_reply = False
    if settings_snap.exists:
        auto_reply = bool(settings_snap.to_dict().get("auto_reply_enabled", False))

    if not snap.exists:
        return WhatsAppStatusResponse(connected=False, auto_reply_enabled=auto_reply)

    data = snap.to_dict() or {}
    return WhatsAppStatusResponse(
        connected=bool(data.get("connected", False)),
        phone_number=data.get("phone_number"),
        push_name=data.get("push_name"),
        platform=data.get("platform", "web"),
        last_sync_at=data.get("last_sync_at"),
        auto_reply_enabled=auto_reply,
        battery_level=data.get("battery_level"),
    )


def save_whatsapp_session(
    database: SqlClient,
    user_id: str,
    connected: bool,
    phone_number: Optional[str] = None,
    push_name: Optional[str] = None,
    session_data: Optional[dict] = None,
):
    doc_ref = _session_doc(database, user_id)
    payload = {
        "connected": connected,
        "phone_number": phone_number,
        "push_name": push_name,
        "last_sync_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if session_data:
        payload["session_data"] = session_data
    doc_ref.set(payload, merge=True)


def clear_whatsapp_session(database: SqlClient, user_id: str):
    doc_ref = _session_doc(database, user_id)
    doc_ref.set({
        "connected": False,
        "phone_number": None,
        "push_name": None,
        "session_data": None,
        "updated_at": datetime.now(timezone.utc),
    }, merge=True)


def get_whatsapp_settings(database: SqlClient, user_id: str) -> WhatsAppSettings:
    from app.core.config import settings as app_settings

    snap = _settings_doc(database, user_id).get()
    if not snap.exists:
        return WhatsAppSettings(
            eve_tag=app_settings.whatsapp_eve_tag,
            owner_name=app_settings.whatsapp_owner_name,
            owner_aliases=app_settings.whatsapp_owner_aliases,
            my_number=app_settings.whatsapp_my_number,
            my_jid=app_settings.whatsapp_my_jid,
        )
    data = snap.to_dict() or {}
    return WhatsAppSettings(
        auto_reply_enabled=bool(data.get("auto_reply_enabled", False)),
        auto_reply_prompt=data.get("auto_reply_prompt", "You are Eve, answering incoming WhatsApp messages concisely on behalf of the user."),
        auto_reply_contacts=data.get("auto_reply_contacts", []),
        notifications_enabled=bool(data.get("notifications_enabled", True)),
        desktop_alerts_enabled=bool(data.get("desktop_alerts_enabled", True)),
        eve_tag=data.get("eve_tag") or app_settings.whatsapp_eve_tag,
        owner_name=data.get("owner_name") or app_settings.whatsapp_owner_name,
        owner_aliases=data.get("owner_aliases") or app_settings.whatsapp_owner_aliases,
        keywords=data.get("keywords") if "keywords" in data else ["@eve", "eve", "@susindran", "@susin", "urgent", "help", "summary", "schedule"],
        my_number=data.get("my_number") or app_settings.whatsapp_my_number,
        my_jid=data.get("my_jid") or app_settings.whatsapp_my_jid,
    )


def save_whatsapp_settings(database: SqlClient, user_id: str, settings: WhatsAppSettings):
    doc_ref = _settings_doc(database, user_id)
    doc_ref.set(settings.model_dump(), merge=True)


def list_whatsapp_chats(database: SqlClient, user_id: str) -> List[WhatsAppChatResponse]:
    query = _chats_col(database, user_id).order_by("updated_at", direction=Query.DESCENDING)
    results = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        last_msg_data = data.get("last_message")
        last_message = None
        if last_msg_data:
            media_data = last_msg_data.get("media")
            media = WhatsAppMediaAttachment(**media_data) if media_data else None
            last_message = WhatsAppMessageResponse(
                id=last_msg_data.get("id", ""),
                chat_id=snap.id,
                sender_id=last_msg_data.get("sender_id", ""),
                sender_name=last_msg_data.get("sender_name"),
                is_from_me=bool(last_msg_data.get("is_from_me", False)),
                is_eve=bool(last_msg_data.get("is_eve", False)),
                content=last_msg_data.get("content", ""),
                timestamp=last_msg_data.get("timestamp", datetime.now(timezone.utc)),
                status=last_msg_data.get("status", "sent"),
                media=media,
            )

        results.append(
            WhatsAppChatResponse(
                id=snap.id,
                name=data.get("name", snap.id),
                phone_number=data.get("phone_number"),
                avatar_url=data.get("avatar_url"),
                is_group=bool(data.get("is_group", False)),
                is_eve=bool(data.get("is_eve", False)),
                participants=data.get("participants") or [],
                description=data.get("description"),
                unread_count=int(data.get("unread_count", 0)),
                pinned=bool(data.get("pinned", False)),
                last_message=last_message,
                updated_at=data.get("updated_at", datetime.now(timezone.utc)),
                eve_auto_reply=bool(data.get("eve_auto_reply", False)),
            )
        )
    return results


def get_whatsapp_chat(database: SqlClient, user_id: str, chat_id: str) -> Optional[WhatsAppChatResponse]:
    doc_ref = _chats_col(database, user_id).document(chat_id)
    snap = doc_ref.get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    return WhatsAppChatResponse(
        id=snap.id,
        name=data.get("name", chat_id),
        phone_number=data.get("phone_number"),
        avatar_url=data.get("avatar_url"),
        is_group=bool(data.get("is_group", False)),
        is_eve=bool(data.get("is_eve", False)),
        participants=data.get("participants"),
        description=data.get("description"),
        unread_count=data.get("unread_count", 0),
        pinned=bool(data.get("pinned", False)),
        last_message=data.get("last_message"),
        updated_at=data.get("updated_at", datetime.now(timezone.utc)),
        eve_auto_reply=bool(data.get("eve_auto_reply", False)),
    )


def upsert_whatsapp_chat(
    database: SqlClient,
    user_id: str,
    chat_id: str,
    name: str,
    phone_number: Optional[str] = None,
    avatar_url: Optional[str] = None,
    is_group: bool = False,
    is_eve: bool = False,
    participants: Optional[List[str]] = None,
    description: Optional[str] = None,
    unread_count: Optional[int] = None,
    pinned: Optional[bool] = None,
    last_message: Optional[dict] = None,
    eve_auto_reply: Optional[bool] = None,
):
    doc_ref = _chats_col(database, user_id).document(chat_id)
    payload: dict[str, Any] = {
        "name": name,
        "is_group": is_group,
        "is_eve": is_eve,
        "updated_at": datetime.now(timezone.utc),
    }
    if phone_number is not None:
        payload["phone_number"] = phone_number
    if avatar_url is not None:
        payload["avatar_url"] = avatar_url
    if participants is not None:
        payload["participants"] = participants
    if description is not None:
        payload["description"] = description
    if unread_count is not None:
        payload["unread_count"] = unread_count
    if pinned is not None:
        payload["pinned"] = pinned
    if last_message is not None:
        payload["last_message"] = last_message
    if eve_auto_reply is not None:
        payload["eve_auto_reply"] = eve_auto_reply

    doc_ref.set(payload, merge=True)


def list_whatsapp_messages(
    database: SqlClient,
    user_id: str,
    chat_id: str,
    limit: int = 50,
    before: Optional[str] = None,
) -> List[WhatsAppMessageResponse]:
    col = _messages_col(database, user_id, chat_id)
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except Exception:
            before_dt = None

        if before_dt:
            query = (
                col.where("timestamp", "<", before_dt)
                .order_by("timestamp", direction=Query.DESCENDING)
                .limit(limit)
            )
        else:
            query = col.order_by("timestamp", direction=Query.DESCENDING).limit(limit)
    else:
        query = col.order_by("timestamp", direction=Query.DESCENDING).limit(limit)

    results = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        media_data = data.get("media")
        media = WhatsAppMediaAttachment(**media_data) if media_data else None
        results.append(
            WhatsAppMessageResponse(
                id=snap.id,
                chat_id=chat_id,
                sender_id=data.get("sender_id", ""),
                sender_name=data.get("sender_name"),
                is_from_me=bool(data.get("is_from_me", False)),
                is_eve=bool(data.get("is_eve", False)),
                content=data.get("content", ""),
                timestamp=data.get("timestamp", datetime.now(timezone.utc)),
                status=data.get("status", "sent"),
                media=media,
                reply_to_message_id=data.get("reply_to_message_id"),
                reactions=data.get("reactions") or [],
                is_forwarded=bool(data.get("is_forwarded", False)),
                is_starred=bool(data.get("is_starred", False)),
                is_pinned=bool(data.get("is_pinned", False)),
                sender_avatar_url=data.get("sender_avatar_url"),
            )
        )
    # Reverse so items are presented in chronological ascending order
    results.reverse()
    return results


def save_whatsapp_message(
    database: SqlClient,
    user_id: str,
    chat_id: str,
    message: WhatsAppMessageResponse,
):
    msg_ref = _messages_col(database, user_id, chat_id).document(message.id)
    payload = message.model_dump()
    msg_ref.set(payload)

    # Update last message on chat
    _chats_col(database, user_id).document(chat_id).set(
        {
            "last_message": payload,
            "updated_at": message.timestamp,
        },
        merge=True,
    )


def add_message_reaction(
    database: SqlClient,
    user_id: str,
    chat_id: str,
    message_id: str,
    emoji: str,
    sender: str = "me",
    sender_name: Optional[str] = None,
):
    msg_ref = _messages_col(database, user_id, chat_id).document(message_id)
    snap = msg_ref.get()
    if snap.exists:
        data = snap.to_dict() or {}
        reactions = data.get("reactions") or []
        # Filter existing reaction from same sender
        reactions = [
            r for r in reactions
            if r.get("sender") != sender and r.get("sender_id") != sender
        ]
        if emoji:
            entry = {"emoji": emoji, "sender": sender}
            if sender_name:
                entry["sender_name"] = sender_name
            reactions.append(entry)
        msg_ref.set({"reactions": reactions}, merge=True)


def star_whatsapp_message(
    database: SqlClient,
    user_id: str,
    chat_id: str,
    message_id: str,
    is_starred: bool,
):
    msg_ref = _messages_col(database, user_id, chat_id).document(message_id)
    msg_ref.set({"is_starred": is_starred}, merge=True)


def delete_whatsapp_message(
    database: SqlClient,
    user_id: str,
    chat_id: str,
    message_id: str,
):
    msg_ref = _messages_col(database, user_id, chat_id).document(message_id)
    msg_ref.delete()


def update_message_status(
    database: SqlClient,
    user_id: str,
    chat_id: str,
    message_id: str,
    status: str,
):
    msg_ref = _messages_col(database, user_id, chat_id).document(message_id)
    msg_ref.set({"status": status}, merge=True)


def mark_chat_as_read(database: SqlClient, user_id: str, chat_id: str):
    _chats_col(database, user_id).document(chat_id).set({"unread_count": 0}, merge=True)
