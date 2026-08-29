from fastapi import APIRouter, Depends, HTTPException, status
from app.db import SqlClient, get_firestore

from app.core.auth import get_current_user
from app.core.cache import CACHE_TTL_SHORT, cache_invalidate_prefix, cached
from app.repositories.calls import CallRepository
from app.repositories.eve_schedules import EveScheduleRepository
from app.schemas.call import CallUser
from app.schemas.eve_schedule import (
    EveScheduleCreate,
    EveScheduleListResponse,
    EveScheduleResponse,
    EveScheduleUpdate,
)
from app.services.eve import chat_with_eve
from app.services.notifications import send_call_notification

router = APIRouter(prefix="/eve/schedules")

_EVE_SCHEDULES_PREFIX = "eve:schedules"


def _invalidate_eve_schedules(user_id: str) -> None:
    cache_invalidate_prefix(f"{_EVE_SCHEDULES_PREFIX}:{user_id}")


@router.get("", response_model=EveScheduleListResponse)
@cached(ttl=CACHE_TTL_SHORT, prefix=_EVE_SCHEDULES_PREFIX)
def list_schedules(
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = EveScheduleRepository(database, user["uid"])
    return {"schedules": repository.list()}


@router.post("", response_model=EveScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(
    payload: EveScheduleCreate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = EveScheduleRepository(database, user["uid"])
    result = repository.create(payload)
    _invalidate_eve_schedules(user["uid"])
    return result


@router.patch("/{schedule_id}", response_model=EveScheduleResponse)
def update_schedule(
    schedule_id: str,
    payload: EveScheduleUpdate,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = EveScheduleRepository(database, user["uid"])
    schedule = repository.update(schedule_id, payload)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found.")
    _invalidate_eve_schedules(user["uid"])
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = EveScheduleRepository(database, user["uid"])
    if not repository.delete(schedule_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found.")
    _invalidate_eve_schedules(user["uid"])


@router.post("/{schedule_id}/run", response_model=EveScheduleResponse)
def run_schedule_now(
    schedule_id: str,
    database: SqlClient = Depends(get_firestore),
    user: dict = Depends(get_current_user),
):
    repository = EveScheduleRepository(database, user["uid"])
    schedule = repository.get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found.")

    action_type = schedule.get("action_type", "chat_prompt")
    prompt = schedule.get("prompt", "Scheduled reminder execution")

    if action_type == "voice_call":
        call_repo = CallRepository(database)
        caller = CallUser(uid="eve-bot", name="Eve AI Assistant", email="eve@starwaves.app")
        callee = CallUser(
            uid=user["uid"],
            name=user.get("display_name") or user.get("name") or "User",
            email=user.get("email") or "",
        )
        call = call_repo.create(caller=caller, callee=callee, mode="audio")
        send_call_notification(
            database=database,
            target_user_id=user["uid"],
            title=f"Scheduled Eve Call: {schedule.get('title')}",
            message=prompt,
            notification_type="call_incoming",
            call_id=call["id"],
        )
    else:
        chat_with_eve(
            database=database,
            user=user,
            messages=[{"role": "user", "content": f"[Automated Schedule: {schedule.get('title')}] {prompt}"}],
        )

    updated = repository.mark_executed(schedule_id)
    return updated or schedule
