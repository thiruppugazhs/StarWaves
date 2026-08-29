"""WhatsApp webhook — dispatches whatsmeow worker events."""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from app.db import SqlClient, get_firestore

from app.core.config import settings

from app.api.routes.whatsapp._shared import has_eve_mention, resolve_chat_name
from app.core.whatsapp_ws_manager import whatsapp_ws_manager
from app.repositories import whatsapp as whatsapp_repo
from app.schemas.whatsapp import WhatsAppMediaAttachment, WhatsAppMessageResponse
from app.services.whatsapp import WhatsAppService

logger = logging.getLogger(__name__)

router = APIRouter()


async def _handle_qr(payload: dict):
    user_id, qr = payload.get("userId"), payload.get("qrCode")
    if user_id and qr:
        await whatsapp_ws_manager.broadcast_to_user(user_id, {"type": "qr_update", "status": "qr_ready", "qr_code": qr, "pairing_code": payload.get("pairingCode")})
    return {"status": "qr_broadcasted"}


async def _handle_status(payload: dict, database: SqlClient):
    user_id, connected = payload.get("userId"), bool(payload.get("connected", False))
    if user_id:
        whatsapp_repo.save_whatsapp_session(database, user_id, connected=connected, phone_number=payload.get("phoneNumber"), push_name=payload.get("pushName"))
        await whatsapp_ws_manager.broadcast_to_user(user_id, {"type": "status_update", "connected": connected, "phone_number": payload.get("phoneNumber"), "push_name": payload.get("pushName")})
    return {"status": "status_updated"}


async def _handle_reaction(payload: dict, database: SqlClient):
    user_id, chat_id, message_id = payload.get("userId"), payload.get("chatId"), payload.get("messageId")
    sender_id, sender_name, emoji = payload.get("senderId") or "other", payload.get("senderName") or payload.get("sender_name"), payload.get("emoji")
    if user_id and chat_id and message_id:
        whatsapp_repo.add_message_reaction(database, user_id, chat_id, message_id, emoji=emoji or "", sender=sender_id, sender_name=sender_name)
        await whatsapp_ws_manager.broadcast_to_user(user_id, {"type": "message_reaction", "chatId": chat_id, "messageId": message_id, "senderId": sender_id, "senderName": sender_name, "emoji": emoji})
    return {"status": "reaction_updated"}


async def _handle_receipt(payload: dict, database: SqlClient):
    user_id, chat_id, mids, st, ts = payload.get("userId"), payload.get("chatId"), payload.get("messageIds") or [], payload.get("status", "delivered"), payload.get("timestamp")
    if user_id and chat_id and mids:
        for mid in mids:
            whatsapp_repo.update_message_status(database, user_id, chat_id, mid, st)
        await whatsapp_ws_manager.broadcast_to_user(user_id, {"type": "receipt_update", "chatId": chat_id, "messageIds": mids, "status": st, "timestamp": ts})
    return {"status": "receipt_updated"}


async def _handle_history(payload: dict, database: SqlClient):
    user_id, chats_data, msgs_data = payload.get("userId"), payload.get("chats") or [], payload.get("messages") or []
    if user_id:
        for c in chats_data:
            c_id = c.get("id")
            if not c_id:
                continue
            is_group = bool(c.get("isGroup", False)) or c_id.endswith("@g.us")
            name = c.get("name")
            if not name or (is_group and name == "Contact"):
                name = "Group conversation" if is_group else c_id
            existing = whatsapp_repo.get_whatsapp_chat(database, user_id, c_id)
            if existing and existing.name and existing.name not in ("Contact", "Group conversation", c_id, "You") and (not name or name in ("Contact", "Group conversation", c_id, "You") or name.startswith("+")):
                name = existing.name
            whatsapp_repo.upsert_whatsapp_chat(database, user_id, chat_id=c_id, name=name, phone_number=c.get("phoneNumber"), avatar_url=c.get("avatarUrl"), is_group=is_group, participants=c.get("participants"), unread_count=int(c.get("unreadCount", 0)))
        for m in msgs_data:
            media_obj = WhatsAppMediaAttachment(**m["media"]) if m.get("media") else None
            msg = WhatsAppMessageResponse(id=m.get("id") or f"msg-{uuid4().hex[:12]}", chat_id=m.get("chatId"), sender_id=m.get("senderId") or "me", sender_name=m.get("senderName"), is_from_me=bool(m.get("isFromMe", False)), is_eve=False, is_forwarded=bool(m.get("isForwarded", False)), content=m.get("content") or "", media=media_obj, reply_to_message_id=m.get("replyToMessageId"), reactions=m.get("reactions") or [], sender_avatar_url=m.get("senderAvatarUrl") or m.get("sender_avatar_url"), timestamp=datetime.fromisoformat(m["timestamp"].replace("Z", "+00:00")) if isinstance(m.get("timestamp"), str) else datetime.now(timezone.utc), status=m.get("status", "delivered"))
            whatsapp_repo.save_whatsapp_message(database, user_id, m.get("chatId"), msg)
        await whatsapp_ws_manager.broadcast_to_user(user_id, {"type": "chats_synced", "count": len(chats_data)})
    return {"status": "synced", "chats": len(chats_data), "messages": len(msgs_data)}


def _verify_worker_signature(request: Request, raw_body: bytes):
    secret = getattr(settings, "whatsapp_worker_secret", None)
    if not secret:
        return  # no secret configured → allow (dev) but warn
    provided = request.headers.get("x-worker-signature") or request.headers.get("x-whatsapp-signature") or ""
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid worker signature.")


@router.post("/webhook")
async def whatsapp_incoming_webhook(request: Request, database: SqlClient = Depends(get_firestore)):
    raw = await request.body()
    _verify_worker_signature(request, raw)
    try:
        payload = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")
    if not isinstance(payload, dict):
        payload = {}
    if payload.get("type") == "qr_update":
        return await _handle_qr(payload)
    if payload.get("type") == "status_update":
        return await _handle_status(payload, database)
    if payload.get("type") == "message_reaction":
        return await _handle_reaction(payload, database)
    if payload.get("type") == "receipt_update":
        return await _handle_receipt(payload, database)
    if payload.get("type") == "history_sync":
        return await _handle_history(payload, database)

    user_id, chat_id = payload.get("userId"), payload.get("chatId")
    content, sender_id, sender_name = payload.get("content", ""), payload.get("senderId", ""), payload.get("senderName") or "Contact"
    sender_avatar_url = payload.get("senderAvatarUrl") or payload.get("sender_avatar_url")
    is_from_me, is_forwarded = payload.get("isFromMe", False), bool(payload.get("isForwarded", False))
    media_obj = WhatsAppMediaAttachment(**payload["media"]) if payload.get("media") else None
    reply_to_id = payload.get("replyToMessageId")
    is_group = bool(payload.get("isGroup", False)) or (bool(chat_id) and chat_id.endswith("@g.us"))
    chat_name = payload.get("chatName")
    if not user_id or not chat_id:
        return {"status": "ignored", "reason": "missing user or chat id"}

    now = datetime.now(timezone.utc)
    incoming = WhatsAppMessageResponse(id=payload.get("messageId") or f"msg-{uuid4().hex[:12]}", chat_id=chat_id, sender_id=sender_id, sender_name=sender_name, is_from_me=is_from_me, is_eve=False, is_forwarded=is_forwarded, content=content, media=media_obj, reply_to_message_id=reply_to_id, sender_avatar_url=sender_avatar_url, timestamp=now, status="delivered")
    whatsapp_repo.save_whatsapp_message(database, user_id, chat_id, incoming)
    existing = whatsapp_repo.get_whatsapp_chat(database, user_id, chat_id)
    resolved_name = resolve_chat_name(chat_id, chat_name, is_group, is_from_me, sender_name, existing)
    whatsapp_repo.upsert_whatsapp_chat(database, user_id, chat_id=chat_id, name=resolved_name, is_group=is_group, last_message=incoming.model_dump(mode="json"))
    await whatsapp_ws_manager.broadcast_to_user(user_id, {"type": "new_message", "message": incoming.model_dump(mode="json")})

    is_eve_chat = chat_id == "eve"
    user_settings = whatsapp_repo.get_whatsapp_settings(database, user_id)
    should = (sender_id != "eve" and not sender_name.lower().startswith("eve")) and (has_eve_mention(content, user_settings) or (is_eve_chat and not is_from_me))
    if should:
        logger.info(f"Eve triggered for WhatsApp message from {sender_name} (from_me={is_from_me}) in {chat_id}")
        await WhatsAppService._handle_eve_response(database, user_id, chat_id, content)
    return {"status": "processed"}
