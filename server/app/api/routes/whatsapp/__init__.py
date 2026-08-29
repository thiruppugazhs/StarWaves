"""WhatsApp routes — single-responsibility package.

Each feature lives in its own module; this package re-exports a combined
router so existing imports (from app.api.routes.whatsapp import router) keep working.
"""

from fastapi import APIRouter

from app.api.routes.whatsapp.chats import router as chats_router
from app.api.routes.whatsapp.messages import router as messages_router
from app.api.routes.whatsapp.settings import router as settings_router
from app.api.routes.whatsapp.status import router as status_router
from app.api.routes.whatsapp.webhook import router as webhook_router

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
router.include_router(status_router)
router.include_router(chats_router)
router.include_router(messages_router)
router.include_router(settings_router)
router.include_router(webhook_router)
