"""Schedule handlers — single responsibility: Eve automated schedules."""

from app.db import SqlClient


def handle_create_eve_schedule(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    from app.repositories.eve_schedules import EveScheduleRepository
    from app.schemas.eve_schedule import EveScheduleCreate

    payload = EveScheduleCreate(
        title=arguments["title"],
        prompt=arguments["prompt"],
        schedule_type=arguments.get("schedule_type", "one_time"),
        action_type=arguments.get("action_type", "chat_prompt"),
        execute_at=arguments.get("execute_at"),
        cron_expression=arguments.get("cron_expression"),
    )
    created = EveScheduleRepository(database, user_id).create(payload)
    return {"schedule": created, "message": f"Automated schedule '{created['title']}' created."}, None, {"type": "refresh_eve_schedules"}


def handle_list_eve_schedules(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.repositories.eve_schedules import EveScheduleRepository

    schedules = EveScheduleRepository(database, user_id).list()
    return {"schedules": schedules, "total": len(schedules)}, None, None


def handle_delete_eve_schedule(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, dict]:
    from app.repositories.eve_schedules import EveScheduleRepository

    deleted = EveScheduleRepository(database, user_id).delete(arguments["schedule_id"])
    if not deleted:
        raise ValueError("Schedule not found.")
    return {"message": "Schedule deleted."}, None, {"type": "refresh_eve_schedules"}
