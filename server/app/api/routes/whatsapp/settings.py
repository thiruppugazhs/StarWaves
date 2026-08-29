"""WhatsApp settings routes."""

from fastapi import APIRouter, Depends
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.repositories import whatsapp as whatsapp_repo
from app.schemas.whatsapp import WhatsAppSettings, WhatsAppSettingsUpdate

router = APIRouter()


@router.get("/settings", response_model=WhatsAppSettings)
def get_whatsapp_settings(current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    return whatsapp_repo.get_whatsapp_settings(database, current_user["uid"])


@router.put("/settings", response_model=WhatsAppSettings)
def update_whatsapp_settings(payload: WhatsAppSettingsUpdate, current_user: dict = Depends(get_current_user), database: SqlClient = Depends(get_firestore)):
    settings_obj = whatsapp_repo.get_whatsapp_settings(database, current_user["uid"])
    update_data = payload.model_dump(exclude_unset=True)
    updated = settings_obj.model_copy(update=update_data)
    whatsapp_repo.save_whatsapp_settings(database, current_user["uid"], updated)
    return updated
