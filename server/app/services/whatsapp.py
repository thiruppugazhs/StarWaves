import base64
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any, List, Optional
from uuid import uuid4

import httpx
from app.db import SqlClient

from app.core.config import settings
from app.core.http import create_async_client
from app.core.whatsapp_ws_manager import whatsapp_ws_manager
from app.repositories import whatsapp as whatsapp_repo
from app.schemas.whatsapp import (
    WhatsAppChatResponse,
    WhatsAppMediaAttachment,
    WhatsAppMessageCreate,
    WhatsAppMessageResponse,
    WhatsAppPairResponse,
    WhatsAppSettings,
    WhatsAppStatusResponse,
)

logger = logging.getLogger(__name__)


class WhatsAppService:
    @staticmethod
    async def get_status(database: SqlClient, user_id: str) -> WhatsAppStatusResponse:
        # Check whatsmeow worker status first if available — non-blocking; fast-fail 1.5s
        try:
            worker_url = settings.whatsapp_gateway_url
            async with create_async_client(timeout=httpx.Timeout(1.5, connect=0.8)) as client:
                resp = await client.get(f"{worker_url}/session/status/{user_id}")
                if resp.is_success:
                    data = resp.json()
                    if data.get("connected"):
                        phone_number = data.get("phoneNumber") or "+1 (555) 019-2834"
                        push_name = data.get("pushName") or "Starwaves User"
                        try:
                            # Save in background thread to not block response
                            import asyncio
                            await asyncio.to_thread(
                                whatsapp_repo.save_whatsapp_session,
                                database,
                                user_id,
                                True,
                                phone_number,
                                push_name,
                            )
                        except Exception:
                            pass
                        return WhatsAppStatusResponse(
                            connected=True,
                            phone_number=phone_number,
                            push_name=push_name,
                            platform="whatsmeow",
                            last_sync_at=datetime.now(timezone.utc),
                        )
        except Exception:
            pass
        # Fallback to DB — run in thread to avoid blocking event loop
        import asyncio
        return await asyncio.to_thread(whatsapp_repo.get_whatsapp_status, database, user_id)

    @staticmethod
    async def initiate_pairing(
        database: SqlClient, user_id: str, phone_number: Optional[str] = None
    ) -> WhatsAppPairResponse:
        pairing_code = None
        qr_code = None

        # Call Go whatsmeow worker service
        try:
            worker_url = settings.whatsapp_gateway_url
            payload = {"userId": user_id}
            if phone_number:
                payload["phoneNumber"] = phone_number

            async with create_async_client(timeout=12.0) as client:
                # First check if worker already has a live QR code cached for this user
                if not phone_number:
                    try:
                        status_resp = await client.get(f"{worker_url}/session/status/{user_id}", timeout=2.0)
                        if status_resp.is_success:
                            status_data = status_resp.json()
                            if status_data.get("qrCode"):
                                qr_code = status_data["qrCode"]
                            if status_data.get("pairingCode"):
                                pairing_code = status_data["pairingCode"]
                    except Exception:
                        pass

                if not qr_code and not pairing_code:
                    resp = await client.post(f"{worker_url}/session/pair", json=payload)
                    if resp.is_success:
                        data = resp.json()
                        if data.get("qrCode"):
                            qr_code = data["qrCode"]
                        if data.get("pairingCode"):
                            pairing_code = data["pairingCode"]
        except Exception as e:
            logger.warning(f"Could not reach whatsmeow worker at {settings.whatsapp_gateway_url}: {e}")

        response = WhatsAppPairResponse(
            status="qr_ready" if qr_code else "waiting",
            qr_code=qr_code,
            pairing_code=pairing_code,
            expires_at=datetime.now(timezone.utc),
            message="Scan the real WhatsApp QR code on your phone or use pairing code." if qr_code else "Connecting to WhatsApp gateway...",
        )

        # Broadcast update via WebSocket to connected clients
        await whatsapp_ws_manager.broadcast_to_user(
            user_id,
            {
                "type": "qr_update",
                "status": "qr_ready" if qr_code else "waiting",
                "qr_code": qr_code,
                "pairing_code": pairing_code,
            },
        )
        return response

    @staticmethod
    async def confirm_connection(
        database: SqlClient,
        user_id: str,
        phone_number: str = "+1 (555) 019-2834",
        push_name: str = "Starwaves User",
    ) -> WhatsAppStatusResponse:
        whatsapp_repo.save_whatsapp_session(
            database=database,
            user_id=user_id,
            connected=True,
            phone_number=phone_number,
            push_name=push_name,
        )

        # Ensure Eve AI contact exists in WhatsApp chats
        WhatsAppService._ensure_eve_chat(database, user_id)

        status_resp = WhatsAppStatusResponse(
            connected=True,
            phone_number=phone_number,
            push_name=push_name,
            platform="web",
            last_sync_at=datetime.now(timezone.utc),
        )

        await whatsapp_ws_manager.broadcast_to_user(
            user_id,
            {
                "type": "connection_state",
                "connected": True,
                "phone_number": phone_number,
                "push_name": push_name,
            },
        )
        return status_resp

    @staticmethod
    def _ensure_eve_chat(database: SqlClient, user_id: str):
        chats = whatsapp_repo.list_whatsapp_chats(database, user_id)
        eve_exists = any(c.id == "eve" or c.is_eve for c in chats)
        if not eve_exists:
            whatsapp_repo.upsert_whatsapp_chat(
                database=database,
                user_id=user_id,
                chat_id="eve",
                name="Eve AI Assistant",
                phone_number="eve@starwaves.app",
                is_group=False,
                is_eve=True,
                unread_count=0,
                pinned=True,
                eve_auto_reply=True,
            )
            # Add welcome message from Eve
            welcome_msg = WhatsAppMessageResponse(
                id=f"msg-{uuid4().hex[:10]}",
                chat_id="eve",
                sender_id="eve",
                sender_name="Eve AI",
                is_from_me=False,
                is_eve=True,
                content="Hello! I'm Eve, your Starwaves AI assistant on WhatsApp. You can ask me questions, have me manage your workspace, draft replies, or message your contacts.",
                timestamp=datetime.now(timezone.utc),
                status="read",
            )
            whatsapp_repo.save_whatsapp_message(database, user_id, "eve", welcome_msg)

    @staticmethod
    async def disconnect(database: SqlClient, user_id: str) -> dict:
        whatsapp_repo.clear_whatsapp_session(database, user_id)
        await whatsapp_ws_manager.broadcast_to_user(
            user_id,
            {
                "type": "connection_state",
                "connected": False,
            },
        )
        return {"status": "disconnected"}

    @staticmethod
    async def list_chats(database: SqlClient, user_id: str) -> List[WhatsAppChatResponse]:
        import asyncio
        # Fast query from database first — offload to thread
        chats = await asyncio.to_thread(whatsapp_repo.list_whatsapp_chats, database, user_id)

        # Sync chats from worker BEFORE returning — ensures pagination/chat list reflects all new chats
        try:
            worker_url = settings.whatsapp_gateway_url
            async with create_async_client(timeout=httpx.Timeout(1.2, connect=0.8)) as client:
                resp = await client.get(f"{worker_url}/session/chats/{user_id}")
                if resp.is_success:
                    worker_chats = resp.json().get("chats") or []
                    for wc in worker_chats:
                        chat_id = wc.get("id")
                        last_msg_data = None
                        last_msg_text = wc.get("lastMessage")
                        if last_msg_text:
                            last_msg_data = {
                                "id": f"last-{chat_id}",
                                "sender_id": "contact",
                                "sender_name": wc.get("name") or "Contact",
                                "content": last_msg_text,
                                "timestamp": wc.get("updatedAt"),
                                "status": "delivered",
                            }
                        await asyncio.to_thread(
                            lambda: whatsapp_repo.upsert_whatsapp_chat(
                                database,
                                user_id,
                                chat_id=chat_id,
                                name=wc.get("name") or chat_id,
                                phone_number=wc.get("phoneNumber"),
                                avatar_url=wc.get("avatarUrl"),
                                is_group=bool(wc.get("isGroup", False)),
                                participants=wc.get("participants"),
                                description=wc.get("description"),
                                unread_count=int(wc.get("unreadCount", 0)),
                                last_message=last_msg_data,
                            )
                        )
                    chats = await asyncio.to_thread(whatsapp_repo.list_whatsapp_chats, database, user_id)
        except Exception:
            pass

        if not any(c.id == "eve" for c in chats):
            await asyncio.to_thread(WhatsAppService._ensure_eve_chat, database, user_id)
            chats = await asyncio.to_thread(whatsapp_repo.list_whatsapp_chats, database, user_id)

        # Sort chats:
        # 1. Pinned or Eve first
        # 2. Chats with real messages by last_message.timestamp descending
        # 3. Remaining contacts by name
        def get_chat_sort_key(c: WhatsAppChatResponse):
            is_pinned = 1 if (c.pinned or c.id == "eve") else 0
            has_message = 1 if (c.last_message and c.last_message.content) else 0
            ts = c.last_message.timestamp if (c.last_message and c.last_message.timestamp) else None
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    ts = None
            if ts is None:
                ts = datetime.min.replace(tzinfo=timezone.utc)
            return (is_pinned, has_message, ts)

        chats.sort(key=get_chat_sort_key, reverse=True)
        return chats

    @staticmethod
    async def get_messages(
        database: SqlClient, user_id: str, chat_id: str, limit: int = 50, before: Optional[str] = None
    ) -> List[WhatsAppMessageResponse]:
        import asyncio
        # Sync new messages from worker BEFORE paging — pagination must reflect all new messages
        if chat_id != "eve":
            try:
                worker_url = settings.whatsapp_gateway_url
                async with create_async_client(timeout=httpx.Timeout(0.8, connect=0.5)) as client:
                    resp = await client.get(f"{worker_url}/session/messages/{user_id}/{chat_id}")
                    if resp.is_success:
                        worker_msgs = resp.json().get("messages") or []
                        if worker_msgs:
                            for wm in worker_msgs:
                                media_data = wm.get("media")
                                media_obj = WhatsAppMediaAttachment(**media_data) if media_data else None
                                msg_obj = WhatsAppMessageResponse(
                                    id=wm.get("id") or f"msg-{uuid4().hex[:12]}",
                                    chat_id=chat_id,
                                    sender_id=wm.get("senderId") or "me",
                                    sender_name=wm.get("senderName"),
                                    is_from_me=bool(wm.get("isFromMe", False)),
                                    is_eve=False,
                                    is_forwarded=bool(wm.get("isForwarded", False)),
                                    content=wm.get("content") or "",
                                    media=media_obj,
                                    reply_to_message_id=wm.get("replyToMessageId"),
                                    sender_avatar_url=wm.get("senderAvatarUrl") or wm.get("sender_avatar_url"),
                                    timestamp=datetime.fromisoformat(wm["timestamp"].replace("Z", "+00:00")) if isinstance(wm.get("timestamp"), str) else datetime.now(timezone.utc),
                                    status=wm.get("status", "delivered"),
                                )
                                await asyncio.to_thread(whatsapp_repo.save_whatsapp_message, database, user_id, chat_id, msg_obj)
            except Exception:
                pass
        msgs = await asyncio.to_thread(whatsapp_repo.list_whatsapp_messages, database, user_id, chat_id, limit, before)
        return msgs

    @staticmethod
    async def send_message(
        database: SqlClient,
        user_id: str,
        chat_id: str,
        content: str,
        media: Optional[WhatsAppMediaAttachment] = None,
        reply_to_message_id: Optional[str] = None,
    ) -> WhatsAppMessageResponse:
        message_id = f"msg-{uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        msg = WhatsAppMessageResponse(
            id=message_id,
            chat_id=chat_id,
            sender_id="me",
            sender_name="Me",
            is_from_me=True,
            is_eve=False,
            content=content,
            timestamp=now,
            status="sent",
            media=media,
            reply_to_message_id=reply_to_message_id,
        )

        whatsapp_repo.save_whatsapp_message(database, user_id, chat_id, msg)

        # Dispatch message to whatsmeow worker if it is an external WhatsApp chat
        if chat_id != "eve":
            try:
                worker_url = settings.whatsapp_gateway_url
                async with create_async_client(timeout=5.0) as client:
                    await client.post(
                        f"{worker_url}/session/send",
                        json={
                            "userId": user_id,
                            "chatId": chat_id,
                            "content": content,
                        },
                    )
            except Exception as e:
                logger.warning(f"Could not forward message to whatsmeow worker: {e}")

        # Broadcast user message via WebSocket
        await whatsapp_ws_manager.broadcast_to_user(
            user_id,
            {
                "type": "new_message",
                "message": msg.model_dump(mode="json"),
            },
        )

        # Handle Eve interaction if messaging Eve or mentioning Eve / owner aliases / custom keywords
        user_settings = whatsapp_repo.get_whatsapp_settings(database, user_id)
        eve_tag = (user_settings.eve_tag or "@eve").lower()
        owner_aliases = [a.lower().strip() for a in (user_settings.owner_aliases or ["@susindran", "@susin"]) if a.strip()]
        keywords = [k.lower().strip() for k in (user_settings.keywords or ["@eve", "eve"]) if k.strip()]
        text_lower = content.lower()

        has_mention = (
            chat_id == "eve"
            or eve_tag in text_lower
            or "@eve" in text_lower
            or any(alias in text_lower for alias in owner_aliases)
            or any(kw in text_lower for kw in keywords)
            or text_lower.startswith("eve ")
            or text_lower == "eve"
        )

        if has_mention:
            await WhatsAppService._handle_eve_response(database, user_id, chat_id, content)

        return msg

    @staticmethod
    async def _handle_eve_response(
        database: SqlClient, user_id: str, chat_id: str, user_prompt: str
    ):
        from app.services.eve import chat_with_eve

        # Fetch recent messages for context
        recent_messages = whatsapp_repo.list_whatsapp_messages(database, user_id, chat_id, limit=10)
        eve_conversation = []
        for m in recent_messages:
            role = "assistant" if (m.is_eve or not m.is_from_me) else "user"
            eve_conversation.append({"role": role, "content": m.content})

        if not eve_conversation or eve_conversation[-1]["content"] != user_prompt:
            eve_conversation.append({"role": "user", "content": user_prompt})

        is_error = False
        try:
            user_dict = {"uid": user_id}
            eve_reply_text, _, _ = chat_with_eve(
                database=database,
                user=user_dict,
                messages=eve_conversation,
                session_id=None,
            )
            eve_reply_text = (eve_reply_text or "").strip()
            if not eve_reply_text or "could not generate a response" in eve_reply_text.lower() or "trouble processing" in eve_reply_text.lower():
                is_error = True
                logger.error(
                    f"[Eve WhatsApp Error] Eve produced empty or error response for user {user_id} in chat {chat_id}: {eve_reply_text}"
                )
        except Exception as err:
            is_error = True
            logger.exception(f"[Eve WhatsApp Error] Exception generating response for user {user_id} in chat {chat_id}: {err}")
            eve_reply_text = ""

        if is_error:
            logger.warning(
                f"[Eve WhatsApp Blocked] Suppressing error message from being sent to external WhatsApp chat {chat_id} (user {user_id})"
            )
            if chat_id != "eve":
                # Do not send failure text to external contacts or groups
                return
            eve_reply_text = "I could not generate a response. Please check the server logs for details."

        eve_msg_id = f"msg-{uuid4().hex[:12]}"
        eve_msg = WhatsAppMessageResponse(
            id=eve_msg_id,
            chat_id=chat_id,
            sender_id="eve",
            sender_name="Eve AI",
            is_from_me=False,
            is_eve=True,
            content=eve_reply_text,
            timestamp=datetime.now(timezone.utc),
            status="delivered",
        )

        whatsapp_repo.save_whatsapp_message(database, user_id, chat_id, eve_msg)

        # Forward Eve's response to whatsmeow worker for external WhatsApp contacts
        if chat_id != "eve" and eve_reply_text:
            try:
                worker_url = settings.whatsapp_gateway_url
                async with create_async_client(timeout=5.0) as client:
                    await client.post(
                        f"{worker_url}/session/send",
                        json={
                            "userId": user_id,
                            "chatId": chat_id,
                            "content": eve_reply_text,
                        },
                    )
            except Exception as e:
                logger.warning(f"Could not forward Eve reply to whatsmeow worker: {e}")

        await whatsapp_ws_manager.broadcast_to_user(
            user_id,
            {
                "type": "new_message",
                "message": eve_msg.model_dump(mode="json"),
            },
        )

    @staticmethod
    async def generate_draft(
        database: SqlClient, user_id: str, chat_id: str, instruction: str
    ) -> str:
        from app.services.eve import chat_with_eve

        recent = whatsapp_repo.list_whatsapp_messages(database, user_id, chat_id, limit=10)
        history_text = "\n".join(
            f"[{'Me' if m.is_from_me else (m.sender_name or 'Them')}]: {m.content}" for m in recent
        )
        prompt = (
            f"Here is the recent WhatsApp chat history:\n{history_text}\n\n"
            f"Instruction: {instruction}\n\n"
            f"Generate only the concise suggested reply message text to send. Do not include quotes or conversational preamble."
        )

        try:
            draft, _, _ = chat_with_eve(
                database=database,
                user={"uid": user_id},
                messages=[{"role": "user", "content": prompt}],
            )
            draft = (draft or "").strip()
            if not draft or "could not generate a response" in draft.lower():
                logger.error(f"[Eve Draft Error] Could not generate draft reply for user {user_id} in chat {chat_id}: {draft}")
                return ""
            return draft
        except Exception as err:
            logger.exception(f"[Eve Draft Error] Failed generating draft for chat {chat_id}: {err}")
            return ""

    @staticmethod
    async def summarize_chat(database: SqlClient, user_id: str, chat_id: str) -> str:
        from app.services.eve import chat_with_eve

        recent = whatsapp_repo.list_whatsapp_messages(database, user_id, chat_id, limit=30)
        history_text = "\n".join(
            f"[{'Me' if m.is_from_me else (m.sender_name or 'Them')}]: {m.content}" for m in recent
        )
        prompt = (
            f"Summarize the following WhatsApp conversation with key points and any action items:\n\n{history_text}"
        )
        try:
            summary, _, _ = chat_with_eve(
                database=database,
                user={"uid": user_id},
                messages=[{"role": "user", "content": prompt}],
            )
            summary = (summary or "").strip()
            if not summary or "could not generate a response" in summary.lower():
                logger.error(f"[Eve Summary Error] Could not generate summary for user {user_id} in chat {chat_id}: {summary}")
                return ""
            return summary
        except Exception as err:
            logger.exception(f"[Eve Summary Error] Failed summarizing chat {chat_id}: {err}")
            return ""

    @staticmethod
    async def chat_about_summary(
        database: SqlClient,
        user_id: str,
        chat_id: str,
        summary: Optional[str],
        messages: List[dict],
    ) -> str:
        from app.services.eve import chat_with_eve

        recent = whatsapp_repo.list_whatsapp_messages(database, user_id, chat_id, limit=35)
        history_text = "\n".join(
            f"[{'Me' if m.is_from_me else (m.sender_name or 'Them')}]: {m.content}" for m in recent
        )

        chat_obj = whatsapp_repo.get_whatsapp_chat(database, user_id, chat_id)
        chat_name = chat_obj.name if chat_obj else chat_id

        system_context = (
            f"You are Eve, an intelligent personal AI assistant helping the user review and interact with a WhatsApp conversation.\n"
            f"Target Chat: '{chat_name}' (ID: {chat_id})\n\n"
            f"=== Recent WhatsApp Messages History ===\n{history_text or 'No prior messages.'}\n\n"
        )
        if summary:
            system_context += f"=== AI Generated Conversation Summary ===\n{summary}\n\n"

        system_context += (
            "The user is asking questions, requesting deeper explanations, asking to draft replies, "
            "inquiring about specific participants, checking action items, or seeking scheduling guidance. "
            "Answer directly, helpfully, accurately, and concisely based on the conversation context."
        )

        eve_messages = [{"role": "system", "content": system_context}]
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role in ("user", "assistant") and content:
                eve_messages.append({"role": role, "content": content})

        if len(eve_messages) <= 1:
            return "How can I help you with this conversation?"

        try:
            reply, _, _ = chat_with_eve(
                database=database,
                user={"uid": user_id},
                messages=eve_messages,
            )
            return (reply or "").strip()
        except Exception as err:
            logger.exception(f"[Eve Summary Chat Error] Failed for user {user_id} on chat {chat_id}: {err}")
            return f"I ran into an issue answering your question: {err}"

