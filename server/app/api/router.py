from fastapi import APIRouter

from app.api.routes import (
    ai_models,
    auth,
    calls,
    calls_twilio,
    coding_stats,
    competitive_coding_profile,
    contacts,
    cron,
    documents,
    email,
    eve,
    eve_memory_settings,
    eve_schedules,
    eve_speech,
    eve_stream,
    gmail,
    google_calendar,
    google_contacts,
    google_drive,
    github,
    google_chat,
    health,
    notifications,
    profiles,
    studio,
    todos,
    ui_preferences,
    unified_models,
    usage,
    whatsapp,
    workspace,
    workspace_files,
)

api_router = APIRouter()
api_router.include_router(whatsapp.router, tags=["WhatsApp integration"])
api_router.include_router(ai_models.router, tags=["AI models settings"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(calls.router, tags=["calls"])
api_router.include_router(calls_twilio.router, tags=["calls"])
api_router.include_router(contacts.router, tags=["contacts"])
api_router.include_router(cron.router, tags=["cron serverless jobs"])
api_router.include_router(email.router, tags=["email"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(notifications.router, tags=["notifications"])
api_router.include_router(profiles.router, tags=["profiles"])
api_router.include_router(documents.router, tags=["documents"])
api_router.include_router(eve.router, tags=["Eve AI assistant"])
api_router.include_router(eve_stream.router, tags=["Eve AI assistant"])
api_router.include_router(eve_schedules.router, tags=["Eve automated schedules"])
api_router.include_router(eve_memory_settings.router, tags=["Eve memory settings"])
api_router.include_router(eve_speech.router, tags=["Eve speech settings"])
api_router.include_router(gmail.router, tags=["Gmail integration"])
api_router.include_router(
    competitive_coding_profile.router,
    tags=["competitive coding settings"],
)
api_router.include_router(google_drive.router, tags=["Google Drive integration"])
api_router.include_router(coding_stats.router, tags=["competitive coding stats"])
api_router.include_router(github.router, tags=["GitHub integration"])
api_router.include_router(
    google_calendar.router,
    tags=["Google Calendar integration"],
)
api_router.include_router(
    google_contacts.router,
    tags=["Google Contacts integration"],
)
api_router.include_router(
    google_chat.router,
    tags=["Google Chat integration"],
)
api_router.include_router(todos.router, tags=["todos"])
api_router.include_router(unified_models.router, tags=["Unified model discovery"])
api_router.include_router(studio.router, tags=["Studio builder"])
api_router.include_router(workspace.router, tags=["workspace data"])
api_router.include_router(workspace_files.router, tags=["workspace files"])
api_router.include_router(ui_preferences.router, tags=["UI preferences"])
api_router.include_router(usage.router, tags=["usage"])

