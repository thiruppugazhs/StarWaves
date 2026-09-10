"""WhatsApp automated reply engine — Tier 1 (Keywords), Tier 2 (Guards/Option A), Tier 3 (Full AI Assistant)."""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

import httpx

from app.core.config import settings
from app.core.http import create_async_client
from app.core.whatsapp_ws_manager import whatsapp_ws_manager
from app.db import SqlClient
from app.repositories import whatsapp as whatsapp_repo
from app.repositories.users import get_user_by_id
from app.schemas.whatsapp import WhatsAppMessageResponse
from app.services.whatsapp_autoreply.rules import match_keyword_rule

logger = logging.getLogger(__name__)

# Debounce tracker: (user_id, chat_id) -> last_reply_timestamp
_last_reply_timestamps: Dict[str, float] = {}
DEBOUNCE_SECONDS = 2.0


def has_assistant_mention(content: str, assistant_name: str, user_settings=None) -> bool:
    """Checks whether the content mentions the user's custom assistant name or tags."""
    if not content:
        return False
    import re
    text_lower = content.lower()
    clean_assistant = (assistant_name or "Eve").lower().strip()

    names_to_check = [clean_assistant]
    if clean_assistant != "eve":
        names_to_check.append("eve")

    for name in names_to_check:
        if f"@{name}" in text_lower:
            return True
        if re.search(r"\b" + re.escape(name) + r"\b", text_lower):
            return True

    if user_settings:
        if getattr(user_settings, "eve_tag", None):
            tag = user_settings.eve_tag.lower().strip()
            if tag in text_lower:
                return True
        for a in getattr(user_settings, "owner_aliases", []) or []:
            if a and a.strip() and a.lower().strip() in text_lower:
                return True
        for kw in getattr(user_settings, "keywords", []) or []:
            if kw and kw.strip() and re.search(r"\b" + re.escape(kw.lower().strip()) + r"\b", text_lower):
                return True

    return False


class WhatsAppAutoReplyEngine:
    """Processes incoming WhatsApp messages through Tier 1 (Keywords), Tier 2 (Guards), and Tier 3 (Full AI)."""

    @classmethod
    async def process_incoming_message(
        cls,
        database: SqlClient,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        user_id = payload.get("user_id") or payload.get("userId")
        chat_id = payload.get("chat_id") or payload.get("chatId")
        content = (payload.get("content") or "").strip()
        sender_id = payload.get("sender_id") or payload.get("senderId") or ""
        sender_name = payload.get("sender_name") or payload.get("senderName") or "Contact"
        is_from_me = bool(payload.get("is_from_me") or payload.get("isFromMe", False))
        is_group = bool(payload.get("is_group") or payload.get("isGroup", False) or (bool(chat_id) and chat_id.endswith("@g.us")))

        if not user_id or not chat_id or not content:
            return {"status": "ignored", "reason": "missing user_id, chat_id, or empty content"}

        # -------------------------------------------------------------
        # Tier 2: Guards & Option A Filtering
        # -------------------------------------------------------------
        # 1. Do not reply to messages sent by the user themselves
        if is_from_me:
            return {"status": "ignored", "reason": "message from self"}

        # 2. Do not reply to automated assistant messages
        if sender_id == "eve" or sender_name.lower().startswith("eve"):
            return {"status": "ignored", "reason": "message from assistant"}

        # Lookup user profile for custom assistant name
        user_record = get_user_by_id(database, user_id) or {}
        assistant_name = user_record.get("assistant_name") or "Eve"

        if sender_name.lower().startswith(assistant_name.lower()):
            return {"status": "ignored", "reason": "message from assistant name"}

        user_settings = whatsapp_repo.get_whatsapp_settings(database, user_id)

        # 3. Option A logic:
        # - Direct (1-on-1) chats: auto-reply to all incoming messages.
        # - Group chats: only reply if the assistant is mentioned.
        if is_group:
            mentioned = has_assistant_mention(content, assistant_name, user_settings)
            if not mentioned:
                return {"status": "ignored", "reason": "group message without assistant mention"}

        # 4. Debounce check: prevent duplicate burst replies
        debounce_key = f"{user_id}:{chat_id}"
        now_ts = time.time()
        last_ts = _last_reply_timestamps.get(debounce_key, 0.0)
        if (now_ts - last_ts) < DEBOUNCE_SECONDS:
            logger.info("Debounce throttled auto-reply for %s in chat %s", user_id, chat_id)
            return {"status": "debounced", "reason": "too fast"}
        _last_reply_timestamps[debounce_key] = now_ts

        # -------------------------------------------------------------
        # Tier 1: Keywords & Predefined Rules (Instant, $0 LLM cost)
        # -------------------------------------------------------------
        matched_rule = match_keyword_rule(content)
        if matched_rule:
            logger.info("Matched keyword rule '%s' for chat %s", matched_rule.name, chat_id)
            reply_text = matched_rule.response_template.format(
                assistant_name=assistant_name,
                sender_name=sender_name or "there",
            )
            return await cls._dispatch_reply(
                database=database,
                user_id=user_id,
                chat_id=chat_id,
                assistant_name=assistant_name,
                reply_text=reply_text,
                tier="keyword_rule",
            )

        # -------------------------------------------------------------
        # Tier 3: Full AI Assistant Response (Contextual LLM)
        # -------------------------------------------------------------
        logger.info("Generating Full AI reply for chat %s using assistant '%s'", chat_id, assistant_name)
        try:
            from app.services.eve import chat_with_eve

            # Fetch recent conversation history
            recent_messages = whatsapp_repo.list_whatsapp_messages(database, user_id, chat_id, limit=10)
            conversation = []
            for m in recent_messages:
                role = "assistant" if (m.is_eve or not m.is_from_me) else "user"
                conversation.append({"role": role, "content": m.content})

            if not conversation or conversation[-1]["content"] != content:
                conversation.append({"role": "user", "content": content})

            user_dict = {"uid": user_id, "name": user_record.get("display_name") or "User"}
            reply_text, _, _ = chat_with_eve(
                database=database,
                user=user_dict,
                messages=conversation,
                session_id=None,
            )
            reply_text = (reply_text or "").strip()

            if not reply_text or "could not generate a response" in reply_text.lower():
                logger.warning("Empty or error LLM response for WhatsApp chat %s; suppressing message", chat_id)
                return {"status": "error", "reason": "empty LLM response"}

            return await cls._dispatch_reply(
                database=database,
                user_id=user_id,
                chat_id=chat_id,
                assistant_name=assistant_name,
                reply_text=reply_text,
                tier="full_ai",
            )
        except Exception as exc:
            logger.exception("Failed generating full AI response for chat %s: %s", chat_id, exc)
            return {"status": "error", "reason": str(exc)}

    @classmethod
    async def _dispatch_reply(
        cls,
        database: SqlClient,
        user_id: str,
        chat_id: str,
        assistant_name: str,
        reply_text: str,
        tier: str,
    ) -> Dict[str, Any]:
        if not reply_text:
            return {"status": "empty"}

        now_utc = datetime.now(timezone.utc)
        msg_id = f"msg-{uuid4().hex[:12]}"
        display_assistant_name = f"{assistant_name} AI"

        outgoing_msg = WhatsAppMessageResponse(
            id=msg_id,
            chat_id=chat_id,
            sender_id="eve",
            sender_name=display_assistant_name,
            is_from_me=False,
            is_eve=True,
            content=reply_text,
            timestamp=now_utc,
            status="delivered",
        )

        # 1. Save to database
        whatsapp_repo.save_whatsapp_message(database, user_id, chat_id, outgoing_msg)
        whatsapp_repo.upsert_whatsapp_chat(
            database,
            user_id,
            chat_id=chat_id,
            last_message=outgoing_msg.model_dump(mode="json"),
        )

        # 2. Broadcast via WebSocket to dashboard UI
        await whatsapp_ws_manager.broadcast_to_user(
            user_id,
            {
                "type": "new_message",
                "message": outgoing_msg.model_dump(mode="json"),
            },
        )

        # 3. Update debounce timestamp
        debounce_key = f"{user_id}:{chat_id}"
        _last_reply_timestamps[debounce_key] = time.time()

        # 4. Dispatch to whatsmeow worker gateway
        worker_url = settings.whatsapp_gateway_url
        dispatched = False
        try:
            async with create_async_client(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
                resp = await client.post(
                    f"{worker_url}/session/send",
                    json={
                        "userId": user_id,
                        "chatId": chat_id,
                        "content": reply_text,
                    },
                )
                dispatched = resp.is_success
                if not dispatched:
                    logger.warning("Worker gateway send failed: HTTP %s - %s", resp.status_code, resp.text)
        except Exception as exc:
            logger.warning("Could not dispatch reply to WhatsApp worker (%s): %s", worker_url, exc)

        return {
            "status": "sent",
            "tier": tier,
            "message_id": msg_id,
            "dispatched_to_worker": dispatched,
        }
