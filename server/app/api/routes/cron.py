import hmac
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from app.db import ArrayUnion, FieldFilter, SERVER_TIMESTAMP, SqlClient, get_firestore

from app.core.config import settings
from app.repositories.calls import CallRepository
from app.repositories.eve_schedules import EveScheduleRepository, list_all_due_schedules
from app.repositories.users import get_user_by_id
from app.schemas.call import CallUser
from app.services.eve import chat_with_eve
from app.services.notifications import send_call_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cron")


def _verify_cron_secret(
    authorization: str | None = Header(None),
    secret: str | None = Query(None),
):
    expected_secret = getattr(settings, "cron_secret", None)
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cron secret not configured.",
        )
    provided = secret or (authorization.removeprefix("Bearer ").strip() if authorization else None) or ""
    if not hmac.compare_digest(provided, expected_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing cron authorization.",
        )
    return True


def run_eve_schedules_job(database: SqlClient) -> dict[str, Any]:
    """Job 1: Execute all due Eve schedules and voice calls."""
    due = list_all_due_schedules(database)
    executed_count = 0
    errors = []

    for schedule in due:
        user_id = schedule.get("user_id")
        schedule_id = schedule.get("id")
        if not user_id or not schedule_id:
            continue

        user_record = get_user_by_id(database, user_id) or {
            "uid": user_id,
            "display_name": "User",
            "email": "",
        }
        action_type = schedule.get("action_type", "chat_prompt")
        prompt = schedule.get("prompt", "Scheduled action execution")
        title = schedule.get("title", "Automated Schedule")

        try:
            if action_type == "voice_call":
                call_repo = CallRepository(database)
                caller = CallUser(uid="eve-bot", name="Eve AI Assistant", email="eve@starwaves.app")
                callee = CallUser(
                    uid=user_id,
                    name=user_record.get("display_name") or "User",
                    email=user_record.get("email") or "",
                )
                call = call_repo.create(caller=caller, callee=callee, mode="audio")
                send_call_notification(
                    database=database,
                    target_user_id=user_id,
                    title=f"Incoming Eve Call ({title})",
                    message=prompt,
                    notification_type="call_incoming",
                    call_id=call["id"],
                )
            else:
                chat_with_eve(
                    database=database,
                    user=user_record,
                    messages=[{"role": "user", "content": f"[Automated Schedule: {title}] {prompt}"}],
                )

            repo = EveScheduleRepository(database, user_id)
            repo.mark_executed(schedule_id)
            executed_count += 1
        except Exception as err:
            logger.error("Failed to execute schedule %s: %s", schedule_id, err)
            errors.append({"schedule_id": schedule_id, "error": str(err)})

    return {
        "job": "eve_schedules",
        "due_count": len(due),
        "executed_count": executed_count,
        "errors": errors,
    }


def run_stale_calls_cleanup_job(database: SqlClient) -> dict[str, Any]:
    """Job 2: Clean up calls stuck in ringing state (> 45s). Bounded 200 for e2-micro parity."""
    cleaned_count = 0
    errors = []
    try:
        now_ts = datetime.now(timezone.utc).timestamp()
        query = database.collection("calls").where(filter=FieldFilter("status", "==", "ringing")).limit(200)
        for doc in query.stream():
            data = doc.to_dict() or {}
            created_at = data.get("created_at")
            if hasattr(created_at, "timestamp") and (now_ts - created_at.timestamp()) > 45:
                doc.reference.update({"status": "missed", "updated_at": SERVER_TIMESTAMP})
                cleaned_count += 1
    except Exception as err:
        logger.error("Failed to clean up stale calls: %s", err)
        errors.append(str(err))

    return {
        "job": "stale_calls_cleanup",
        "cleaned_count": cleaned_count,
        "errors": errors,
    }


def run_daily_maintenance_job(database: SqlClient) -> dict[str, Any]:
    """Job 3: General daily workspace maintenance and cleanup. Bounded 500."""
    cleaned_notifications = 0
    errors = []
    try:
        now_ts = datetime.now(timezone.utc).timestamp()
        # Clean up read notifications older than 30 days
        thirty_days_ago = now_ts - (30 * 86400)
        query = database.collection_group("notifications").where(filter=FieldFilter("read", "==", True)).limit(500)
        for doc in query.stream():
            data = doc.to_dict() or {}
            created_at = data.get("created_at")
            if hasattr(created_at, "timestamp") and created_at.timestamp() < thirty_days_ago:
                doc.reference.delete()
                cleaned_notifications += 1
    except Exception as err:
        logger.warning("Daily maintenance notice: %s", err)
        errors.append(str(err))

    return {
        "job": "daily_maintenance",
        "cleaned_notifications": cleaned_notifications,
        "errors": errors,
    }


@router.api_route("/process-jobs", methods=["GET", "POST"])
@router.api_route("/run-all", methods=["GET", "POST"])
@router.api_route("/execute-schedules", methods=["GET", "POST"])
def process_all_serverless_jobs(
    database: SqlClient = Depends(get_firestore),
    authorized: bool = Depends(_verify_cron_secret),
):
    """Unified Vercel Serverless Cron Endpoint.

    Executes all scheduled batch jobs (schedules execution, stale call cleanup,
    and daily maintenance) inside one single invocation to comply with Vercel Hobby
    plan daily cron job limits.
    """
    schedules_result = run_eve_schedules_job(database)
    calls_result = run_stale_calls_cleanup_job(database)
    maintenance_result = run_daily_maintenance_job(database)

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "jobs": {
            "eve_schedules": schedules_result,
            "stale_calls": calls_result,
            "daily_maintenance": maintenance_result,
        },
    }
