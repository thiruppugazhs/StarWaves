"""WhatsApp chat listing, message history, and AI summary routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.repositories import whatsapp as whatsapp_repo
from app.schemas.whatsapp import WhatsAppChatResponse, WhatsAppMessageResponse, WhatsAppSummaryChatRequest
from app.services.whatsapp import WhatsAppService

router = APIRouter()


@router.get("/chats", response_model=List[WhatsAppChatResponse])
async def list_whatsapp_chats(current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    return await WhatsAppService.list_chats(database, current_user["uid"])


@router.get("/chats/{chat_id}/messages", response_model=List[WhatsAppMessageResponse])
async def get_whatsapp_messages(chat_id: str, limit: int = Query(default=50, ge=1, le=100), before: Optional[str] = Query(default=None, description="ISO timestamp to fetch messages prior to"), current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    return await WhatsAppService.get_messages(database, current_user["uid"], chat_id, limit=limit, before=before)


@router.post("/chats/{chat_id}/read")
def mark_chat_read(chat_id: str, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    whatsapp_repo.mark_chat_as_read(database, current_user["uid"], chat_id)
    return {"status": "ok"}


@router.post("/chats/{chat_id}/summarize")
async def summarize_whatsapp_chat(chat_id: str, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    summary = await WhatsAppService.summarize_chat(database, current_user["uid"], chat_id)
    return {"summary": summary}


@router.post("/chats/{chat_id}/summary-chat")
async def chat_about_whatsapp_summary_endpoint(chat_id: str, payload: WhatsAppSummaryChatRequest, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    reply = await WhatsAppService.chat_about_summary(database=database, user_id=current_user["uid"], chat_id=chat_id, summary=payload.summary, messages=[m.model_dump() for m in payload.messages])
    return {"reply": reply}


@router.post("/eve-draft")
async def generate_eve_draft(payload: dict, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    # Keep compatibility: payload expects chat_id + instruction
    from app.schemas.whatsapp import WhatsAppEveDraftRequest
    req = WhatsAppEveDraftRequest(**payload)
    draft = await WhatsAppService.generate_draft(database=database, user_id=current_user["uid"], chat_id=req.chat_id, instruction=req.instruction or "Draft a friendly reply")
    return {"draft": draft}
