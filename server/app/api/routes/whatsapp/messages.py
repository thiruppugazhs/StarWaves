"""WhatsApp send / reaction / star / delete routes."""

import httpx
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.whatsapp_ws_manager import whatsapp_ws_manager
from app.repositories import whatsapp as whatsapp_repo
from app.schemas.whatsapp import WhatsAppMessageCreate, WhatsAppMessageResponse
from app.services.whatsapp import WhatsAppService


class ReactPayload(BaseModel):
    emoji: str = Field(default="", max_length=8)


class StarPayload(BaseModel):
    is_starred: bool = True

router = APIRouter()


@router.post("/send", response_model=WhatsAppMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_whatsapp_message(payload: WhatsAppMessageCreate, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    return await WhatsAppService.send_message(database=database, user_id=current_user["uid"], chat_id=payload.chat_id, content=payload.content, media=payload.media, reply_to_message_id=payload.reply_to_message_id)


@router.post("/chats/{chat_id}/messages/{message_id}/react")
async def react_to_message(chat_id: str, message_id: str, payload: ReactPayload, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    emoji = payload.emoji
    whatsapp_repo.add_message_reaction(database, current_user["uid"], chat_id, message_id, emoji=emoji, sender="me")
    if chat_id != "eve":
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                await client.post(f"{settings.whatsapp_gateway_url}/session/react", json={"userId": current_user["uid"], "chatId": chat_id, "messageId": message_id, "reaction": emoji})
        except Exception:
            pass
    await whatsapp_ws_manager.broadcast_to_user(current_user["uid"], {"type": "message_reaction", "chat_id": chat_id, "message_id": message_id, "emoji": emoji, "sender": "me"})
    return {"status": "ok"}


@router.post("/chats/{chat_id}/messages/{message_id}/star")
async def star_message_endpoint(chat_id: str, message_id: str, payload: StarPayload, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    is_starred = bool(payload.is_starred)
    whatsapp_repo.star_whatsapp_message(database, current_user["uid"], chat_id, message_id, is_starred=is_starred)
    return {"status": "ok", "is_starred": is_starred}


@router.delete("/chats/{chat_id}/messages/{message_id}")
async def delete_message_endpoint(chat_id: str, message_id: str, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    whatsapp_repo.delete_whatsapp_message(database, current_user["uid"], chat_id, message_id)
    await whatsapp_ws_manager.broadcast_to_user(current_user["uid"], {"type": "message_deleted", "chat_id": chat_id, "message_id": message_id})
    return {"status": "ok"}
