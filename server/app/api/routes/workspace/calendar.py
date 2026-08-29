"""Calendar-data route: aggregates projects, jobs, and hackathons for the calendar view."""

import asyncio

from fastapi import APIRouter, Depends
from app.db import SqlClient, get_firestore

from app.api.routes.workspace._shared import hackathon_settings_reference, user_collection
from app.core.auth import get_current_user
from app.services.hackathon_sources import fetch_enabled_hackathons

router = APIRouter()


@router.get("/calendar-data")
async def calendar_data(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    def load_collections():
        result = {}
        for name in ("projects", "jobs", "hackathons"):
            records = user_collection(database, user["uid"], name).stream()
            result[name] = [{"id": item.id, **(item.to_dict() or {})} for item in records]
        return result

    result = await asyncio.to_thread(load_collections)
    settings = hackathon_settings_reference(database, user["uid"]).get().to_dict() or {}
    result["hackathons"] = [
        {"id": item["id"], "source": "manual", **item}
        for item in result["hackathons"]
        if item.get("ends_at")
    ] + await fetch_enabled_hackathons(settings.get("enabled", []))
    return result
