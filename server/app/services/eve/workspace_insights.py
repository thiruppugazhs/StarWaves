"""Workspace insight helpers — single responsibility: deadline and dashboard insights."""

from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.db import SqlClient

from app.services.eve.constants import SUPPORTED_RESOURCES
from app.services.eve.workspace_records import _all_records, _record_text

# Local helper to avoid circular import — _record_text is also defined in workspace_records
def _parse_date(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None



def _deadline_entries(records: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    entries = []
    for todo in records["todos"]:
        due = _parse_date(todo.get("due_date"))
        if due:
            entries.append({"resource": "todos", "id": todo["id"], "title": todo.get("title"), "date": due.isoformat()})
    for job in records["jobs"]:
        for field in ("deadline", "interview_date"):
            due = _parse_date(job.get(field))
            if due:
                entries.append({"resource": "jobs", "id": job["id"], "title": f"{job.get('role')} at {job.get('company')}", "date": due.isoformat(), "kind": field})
    for hackathon in records["hackathons"]:
        starts = _parse_date(hackathon.get("starts_at"))
        if starts:
            entries.append({"resource": "hackathons", "id": hackathon["id"], "title": hackathon.get("title"), "date": starts.isoformat()})
    return sorted(entries, key=lambda item: item["date"])



def _workspace_insight(database: SqlClient, user_id: str, kind: str, date_value: str | None = None, query: str | None = None) -> dict[str, Any]:
    records = _all_records(database, user_id)
    now = datetime.now(timezone.utc)
    today = date_value or now.date().isoformat()
    deadlines = _deadline_entries(records)
    if kind == "summarize_dashboard":
        return {
            "counts": {resource: len(items) for resource, items in records.items()},
            "open_todos": len([todo for todo in records["todos"] if not todo.get("completed")]),
            "unread_notifications": len([item for item in records["notifications"] if item.get("unread")]),
            "upcoming_deadlines": deadlines[:8],
        }
    if kind == "summarize_upcoming_deadlines":
        cutoff = now + timedelta(days=14)
        return {"deadlines": [item for item in deadlines if now.isoformat() <= item["date"] <= cutoff.isoformat()]}
    if kind == "find_overdue_tasks":
        return {"tasks": [todo for todo in records["todos"] if not todo.get("completed") and (due := _parse_date(todo.get("due_date"))) and due < now]}
    if kind == "find_stale_projects":
        cutoff = now - timedelta(days=14)
        return {"projects": [project for project in records["projects"] if project.get("status") != "Completed" and (_parse_date(project.get("updated_at")) or now) < cutoff]}
    if kind == "suggest_next_actions":
        return {"basis": {"overdue": _workspace_insight(database, user_id, "find_overdue_tasks"), "deadlines": deadlines[:5], "stale_projects": _workspace_insight(database, user_id, "find_stale_projects")}}
    if kind == "export_workspace_summary":
        return {"summary": records}
    if kind in ("summarize_calendar_day", "filter_calendar_events"):
        matches = [item for item in deadlines if item["date"].startswith(today)]
        if query:
            matches = [item for item in matches if query.lower() in _record_text(item)]
        return {"date": today, "events": matches}
    supported_kinds = (
        "summarize_dashboard",
        "summarize_upcoming_deadlines",
        "find_overdue_tasks",
        "find_stale_projects",
        "suggest_next_actions",
        "export_workspace_summary",
        "summarize_calendar_day",
        "filter_calendar_events",
    )
    return {"error": f"Unknown insight kind '{kind}'. Supported kinds: {', '.join(supported_kinds)}."}



