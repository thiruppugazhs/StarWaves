import asyncio

from fastapi import APIRouter, Depends
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.services.coding_stats import (
    load_coding_stats,
    load_platform_coding_stats,
)

router = APIRouter(prefix="/stats/competitive-coding")


def coding_settings(database: SqlClient, user_id: str) -> dict:
    settings_collection = (
        database.collection("users")
        .document(user_id)
        .collection("settings")
    )
    snapshot = settings_collection.document("competitive-coding").get()
    if not snapshot.exists:
        snapshot = settings_collection.document("competitive-programming").get()
    return snapshot.to_dict() if snapshot.exists else {}


@router.get("")
async def get_coding_stats(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    settings = await asyncio.to_thread(coding_settings, database, user["uid"])
    return await load_coding_stats(settings)


@router.get("/codeforces")
async def get_codeforces_stats(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    settings = await asyncio.to_thread(coding_settings, database, user["uid"])
    return await load_platform_coding_stats(
        "codeforces",
        settings.get("codeforces", ""),
    )


@router.get("/codechef")
async def get_codechef_stats(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    settings = await asyncio.to_thread(coding_settings, database, user["uid"])
    return await load_platform_coding_stats(
        "codechef",
        settings.get("codechef", ""),
    )


@router.get("/leetcode")
async def get_leetcode_stats(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    settings = await asyncio.to_thread(coding_settings, database, user["uid"])
    return await load_platform_coding_stats(
        "leetcode",
        settings.get("leetcode", ""),
    )
