"""Registry of SQL entity handlers — single source for client routing.

Replaces 3x ~15-branch if-chains in client.py (_get_doc, _set_doc, _query_coll, _delete_doc)
with a declarative table. Add a new entity by adding one entry here.
"""

from app.db.sql.calls import delete_call_doc, get_call_doc, query_calls, set_call_doc
from app.db.sql.contacts import delete_contact_doc, get_contact_doc, query_contacts, set_contact_doc
from app.db.sql.documents import delete_document_doc, get_document_doc, query_documents, set_document_doc
from app.db.sql.eve import (
    delete_eve_memory_doc,
    delete_eve_schedule_doc,
    delete_eve_session_doc,
    get_eve_memory_doc,
    get_eve_schedule_doc,
    get_eve_session_doc,
    query_eve_memories,
    query_eve_schedules,
    query_eve_sessions,
    set_eve_memory_doc,
    set_eve_schedule_doc,
    set_eve_session_doc,
)
from app.db.sql.hackathons import delete_hackathon_doc, get_hackathon_doc, query_hackathons, set_hackathon_doc
from app.db.sql.jobs import delete_job_doc, get_job_doc, query_jobs, set_job_doc
from app.db.sql.notifications import delete_notification_doc, get_notification_doc, query_notifications, set_notification_doc
from app.db.sql.projects import delete_project_doc, get_project_doc, query_projects, set_project_doc
from app.db.sql.todos import delete_todo_doc, get_todo_doc, query_todos, set_todo_doc
from app.db.sql.users import delete_user_doc, get_user_doc, query_users, set_user_doc

# Keyed by path pattern -> handler dict
# For top-level: (1, "users") ; for user-scoped: (3, "users", "<coll>")
# WhatsApp handlers are handled separately due to extra chat_id param, but still listed for completeness

REGISTRY: dict[tuple, dict] = {
    (1, "users"): {"get": get_user_doc, "set": set_user_doc, "delete": delete_user_doc, "query": query_users},
    (1, "calls"): {"get": get_call_doc, "set": set_call_doc, "delete": delete_call_doc, "query": query_calls},
    (3, "users", "todos"): {"get": get_todo_doc, "set": set_todo_doc, "delete": delete_todo_doc, "query": query_todos},
    (3, "users", "jobs"): {"get": get_job_doc, "set": set_job_doc, "delete": delete_job_doc, "query": query_jobs},
    (3, "users", "projects"): {"get": get_project_doc, "set": set_project_doc, "delete": delete_project_doc, "query": query_projects},
    (3, "users", "hackathons"): {"get": get_hackathon_doc, "set": set_hackathon_doc, "delete": delete_hackathon_doc, "query": query_hackathons},
    (3, "users", "documents"): {"get": get_document_doc, "set": set_document_doc, "delete": delete_document_doc, "query": query_documents},
    (3, "users", "contacts"): {"get": get_contact_doc, "set": set_contact_doc, "delete": delete_contact_doc, "query": query_contacts},
    (3, "users", "notifications"): {"get": get_notification_doc, "set": set_notification_doc, "delete": delete_notification_doc, "query": query_notifications},
    (3, "users", "eve_sessions"): {"get": get_eve_session_doc, "set": set_eve_session_doc, "delete": delete_eve_session_doc, "query": query_eve_sessions},
    (3, "users", "eve_memories"): {"get": get_eve_memory_doc, "set": set_eve_memory_doc, "delete": delete_eve_memory_doc, "query": query_eve_memories},
    (3, "users", "eve_schedules"): {"get": get_eve_schedule_doc, "set": set_eve_schedule_doc, "delete": delete_eve_schedule_doc, "query": query_eve_schedules},
}


def _key_for_path(path_parts: list[str]) -> tuple | None:
    """Derive registry key from path_parts. Returns None if not in registry."""
    if len(path_parts) == 1:
        return (1, path_parts[0])
    if len(path_parts) == 3 and path_parts[0] == "users":
        return (3, "users", path_parts[2])
    # WhatsApp and settings handled outside registry
    return None


def lookup(path_parts: list[str], op: str):
    key = _key_for_path(path_parts)
    if key is None:
        return None
    entry = REGISTRY.get(key)
    if not entry:
        return None
    return entry.get(op)
