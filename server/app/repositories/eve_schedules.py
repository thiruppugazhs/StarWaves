import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db import ArrayUnion, FieldFilter, Query, SERVER_TIMESTAMP, SqlClient


from app.schemas.eve_schedule import EveScheduleCreate, EveScheduleUpdate


def _compute_next_run(
    schedule_type: str,
    execute_at: str | None,
    cron_expression: str | None,
) -> str:
    now = datetime.now(timezone.utc)
    if schedule_type == "one_time":
        if execute_at:
            return execute_at
        return (now + timedelta(hours=1)).isoformat()

    # Recurring cron estimation
    if cron_expression:
        parts = cron_expression.strip().split()
        if len(parts) == 5:
            # Simple interval estimation for common crons
            if parts[0].startswith("*/"):
                try:
                    mins = int(parts[0].replace("*/", ""))
                    return (now + timedelta(minutes=mins)).isoformat()
                except ValueError:
                    pass
            elif parts[1].startswith("*/"):
                try:
                    hrs = int(parts[1].replace("*/", ""))
                    return (now + timedelta(hours=hrs)).isoformat()
                except ValueError:
                    pass

    # Default 24h recurring schedule interval
    return (now + timedelta(days=1)).isoformat()


class EveScheduleRepository:
    def __init__(self, database: SqlClient, user_id: str):
        self.database = database
        self.user_id = user_id
        self.collection = (
            database.collection("users")
            .document(user_id)
            .collection("eve_schedules")
        )

    def create(self, payload: EveScheduleCreate) -> dict[str, Any]:
        schedule_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        next_run = _compute_next_run(
            payload.schedule_type,
            payload.execute_at,
            payload.cron_expression,
        )

        data = {
            "id": schedule_id,
            "user_id": self.user_id,
            "title": payload.title,
            "prompt": payload.prompt,
            "schedule_type": payload.schedule_type,
            "action_type": payload.action_type,
            "execute_at": payload.execute_at,
            "cron_expression": payload.cron_expression,
            "enabled": payload.enabled,
            "last_run_at": None,
            "next_run_at": next_run,
            "created_at": now,
            "updated_at": now,
        }
        self.collection.document(schedule_id).set(data)
        return data

    def list(self) -> list[dict[str, Any]]:
        docs = self.collection.order_by("created_at", direction=Query.DESCENDING).stream()
        return [{"id": doc.id, **(doc.to_dict() or {})} for doc in docs]

    def get(self, schedule_id: str) -> dict[str, Any] | None:
        doc = self.collection.document(schedule_id).get()
        if not doc.exists:
            return None
        return {"id": doc.id, **(doc.to_dict() or {})}

    def update(self, schedule_id: str, updates: EveScheduleUpdate) -> dict[str, Any] | None:
        ref = self.collection.document(schedule_id)
        doc = ref.get()
        if not doc.exists:
            return None
        clean_data = updates.model_dump(exclude_unset=True)
        now = datetime.now(timezone.utc).isoformat()
        clean_data["updated_at"] = now

        existing = doc.to_dict() or {}
        stype = clean_data.get("schedule_type", existing.get("schedule_type", "one_time"))
        exec_at = clean_data.get("execute_at", existing.get("execute_at"))
        cron = clean_data.get("cron_expression", existing.get("cron_expression"))
        clean_data["next_run_at"] = _compute_next_run(stype, exec_at, cron)

        ref.update(clean_data)
        return {"id": doc.id, **(ref.get().to_dict() or {})}

    def delete(self, schedule_id: str) -> bool:
        ref = self.collection.document(schedule_id)
        if not ref.get().exists:
            return False
        ref.delete()
        return True

    def mark_executed(self, schedule_id: str) -> dict[str, Any] | None:
        ref = self.collection.document(schedule_id)
        doc = ref.get()
        if not doc.exists:
            return None
        data = doc.to_dict() or {}
        now = datetime.now(timezone.utc)
        now_str = now.isoformat()

        if data.get("schedule_type") == "one_time":
            updates = {
                "enabled": False,
                "last_run_at": now_str,
                "next_run_at": None,
                "updated_at": now_str,
            }
        else:
            next_run = _compute_next_run(
                data.get("schedule_type", "recurring"),
                data.get("execute_at"),
                data.get("cron_expression"),
            )
            updates = {
                "last_run_at": now_str,
                "next_run_at": next_run,
                "updated_at": now_str,
            }
        ref.update(updates)
        return {"id": doc.id, **(ref.get().to_dict() or {})}


def list_all_due_schedules(database: SqlClient) -> list[dict[str, Any]]:
    now_str = datetime.now(timezone.utc).isoformat()
    results = []
    # Stream across user subcollections for active due schedules
    try:
        query = database.collection_group("eve_schedules").where(filter=FieldFilter("enabled", "==", True))
        for doc in query.stream():
            data = doc.to_dict() or {}
            next_run = data.get("next_run_at")
            if next_run and next_run <= now_str:
                results.append({"id": doc.id, **data})
    except Exception:
        # Fallback to scanning users collection if collection group index is pending
        users_docs = database.collection("users").limit(100).stream()
        for u in users_docs:
            s_docs = (
                database.collection("users")
                .document(u.id)
                .collection("eve_schedules")
                .where(filter=FieldFilter("enabled", "==", True))
                .stream()
            )
            for s in s_docs:
                data = s.to_dict() or {}
                next_run = data.get("next_run_at")
                if next_run and next_run <= now_str:
                    results.append({"id": s.id, **data})
    return results
