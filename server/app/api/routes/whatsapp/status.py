"""WhatsApp pairing / status / disconnect routes."""

from fastapi import APIRouter, Depends, Query
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.schemas.whatsapp import WhatsAppPairRequest, WhatsAppPairResponse, WhatsAppStatusResponse
from app.services.whatsapp import WhatsAppService

router = APIRouter()


@router.get("/status", response_model=WhatsAppStatusResponse)
async def get_whatsapp_status(current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    return await WhatsAppService.get_status(database, current_user["uid"])


@router.post("/pair", response_model=WhatsAppPairResponse)
async def initiate_whatsapp_pairing(payload: WhatsAppPairRequest = WhatsAppPairRequest(), current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    return await WhatsAppService.initiate_pairing(database=database, user_id=current_user["uid"], phone_number=payload.phone_number)


@router.post("/confirm-pairing", response_model=WhatsAppStatusResponse)
async def confirm_whatsapp_pairing(phone_number: str = Query(default="+1 (555) 019-2834"), push_name: str = Query(default="Starwaves User"), current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    return await WhatsAppService.confirm_connection(database=database, user_id=current_user["uid"], phone_number=phone_number, push_name=push_name)


@router.post("/disconnect")
async def disconnect_whatsapp(current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    return await WhatsAppService.disconnect(database, current_user["uid"])
