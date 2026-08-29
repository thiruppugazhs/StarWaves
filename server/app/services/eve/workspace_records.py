"""Workspace record helpers — single responsibility: CRUD for workspace resources."""

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from app.db import ArrayUnion, SERVER_TIMESTAMP, SqlClient
from pydantic import ValidationError

from app.repositories import documents, eve_sessions, todos
from app.repositories.jobs import JobRepository
from app.repositories.notifications import NotificationRepository
from app.repositories.projects import ProjectRepository
from app.schemas.document import DocumentUpsert
from app.schemas.todo import TodoCreate, TodoUpdate
from app.schemas.workspace import HackathonCreate, HackathonUpdate, JobCreate, JobUpdate, NotificationUpdate, ProjectCreate, ProjectUpdate
from app.services.eve.constants import MAX_RECORDS_PER_READ, SUPPORTED_RESOURCES

logger = logging.getLogger(__name__)

def _list_records(database: SqlClient, user_id: str, resource: str) -> list[dict[str, Any]]:
    if resource == "todos":
        return [todo.model_dump(mode="json") for todo in todos.list_todos(database, user_id)]
    if resource == "projects":
        items, _, _ = ProjectRepository(database, user_id).list_page(None, MAX_RECORDS_PER_READ)
        return items
    if resource == "jobs":
        items, _, _ = JobRepository(database, user_id).list_page(None, MAX_RECORDS_PER_READ)
        return items
    if resource == "hackathons":
        snapshots = (
            database.collection("users")
            .document(user_id)
            .collection("hackathons")
            .order_by("starts_at")
            .limit(MAX_RECORDS_PER_READ)
            .stream()
        )
        return [{"id": item.id, **(item.to_dict() or {})} for item in snapshots]
    if resource == "documents":
        return [document.model_dump(mode="json") for document in documents.list_documents(database, user_id)]
    if resource == "notifications":
        items, _, _ = NotificationRepository(database, user_id).list_page(None, MAX_RECORDS_PER_READ)
        return items
    raise ValueError("Unsupported workspace resource.")



def _all_records(database: SqlClient, user_id: str) -> dict[str, list[dict[str, Any]]]:
    return {resource: _list_records(database, user_id, resource) for resource in SUPPORTED_RESOURCES}



def _record_text(record: dict[str, Any]) -> str:
    return " ".join(str(value) for value in record.values() if value is not None).lower()



def _clean_record_id(resource: str, record_id: str) -> str:
    if resource == "projects" and record_id.startswith("project-"):
        return record_id.removeprefix("project-")
    return record_id



def _search_records(database: SqlClient, user_id: str, query: str, resources: list[str] | None = None) -> dict[str, Any]:
    terms = [term for term in query.lower().split() if term]
    selected = resources or list(SUPPORTED_RESOURCES)
    results = []
    for resource in selected:
      if resource not in SUPPORTED_RESOURCES:
          continue
      for record in _list_records(database, user_id, resource):
          text = _record_text(record)
          if all(term in text for term in terms):
              results.append({"resource": resource, "record": record})
    return {"query": query, "results": results[:25], "total": len(results)}



def _explain_record(database: SqlClient, user_id: str, resource: str, record_id: str) -> dict[str, Any]:
    record = next((item for item in _list_records(database, user_id, resource) if item["id"] == record_id), None)
    if not record:
        raise ValueError("Record not found.")
    return {"resource": resource, "record": record}



def _create_record(database: SqlClient, user_id: str, resource: str, data: dict[str, Any]) -> dict[str, Any]:
    if resource == "todos":
        return todos.create_todo(database, user_id, TodoCreate.model_validate(data)).model_dump(mode="json")
    if resource == "projects":
        return ProjectRepository(database, user_id).create(ProjectCreate.model_validate(data))
    if resource == "jobs":
        return JobRepository(database, user_id).create(JobCreate.model_validate(data))
    if resource == "hackathons":
        reference = database.collection("users").document(user_id).collection("hackathons").document()
        hackathon = HackathonCreate.model_validate(data)
        reference.set(hackathon.model_dump(mode="python"))
        return {"id": reference.id, **(reference.get().to_dict() or {})}
    if resource == "documents":
        document_id = str(data.pop("id", "") or uuid4())
        return documents.upsert_document(
            database, user_id, document_id, DocumentUpsert.model_validate(data)
        ).model_dump(mode="json")
    raise ValueError("Unsupported workspace resource.")



def _update_record(
    database: SqlClient, user_id: str, resource: str, record_id: str, changes: dict[str, Any]
) -> dict[str, Any]:
    record_id = _clean_record_id(resource, record_id)
    if resource == "todos":
        result = todos.update_todo(database, user_id, record_id, TodoUpdate.model_validate(changes))
    elif resource == "projects":
        result = ProjectRepository(database, user_id).patch(
            record_id, ProjectUpdate.model_validate(changes).model_dump(exclude_unset=True)
        )
    elif resource == "jobs":
        result = JobRepository(database, user_id).update(
            record_id, JobUpdate.model_validate(changes).model_dump(exclude_unset=True)
        )
    elif resource == "hackathons":
        reference = database.collection("users").document(user_id).collection("hackathons").document(record_id)
        if not reference.get().exists:
            result = None
        else:
            reference.update(HackathonUpdate.model_validate(changes).model_dump(exclude_unset=True, mode="python"))
            result = {"id": reference.id, **(reference.get().to_dict() or {})}
    elif resource == "documents":
        existing = next((item for item in _list_records(database, user_id, resource) if item["id"] == record_id), None)
        if not existing:
            result = None
        else:
            merged = {**existing, **changes}
            merged.pop("id", None)
            result = documents.upsert_document(
                database, user_id, record_id, DocumentUpsert.model_validate(merged)
            )
    elif resource == "notifications":
        result = NotificationRepository(database, user_id).update(
            record_id,
            NotificationUpdate.model_validate(changes),
        )
    else:
        raise ValueError("Unsupported workspace resource.")
    if result is None:
        raise ValueError("Record not found.")
    return result.model_dump(mode="json") if hasattr(result, "model_dump") else result



def _generate_text_artifact(
    database: SqlClient,
    user_id: str,
    kind: str,
    resource: str | None = None,
    record_id: str | None = None,
    prompt: str | None = None,
) -> dict[str, Any]:
    context = None
    if resource and record_id:
        context = _explain_record(database, user_id, resource, record_id)
    return {
        "kind": kind,
        "prompt": prompt or "",
        "context": context,
        "instruction": "Use this context to draft useful text. Do not send external messages.",
    }



def _bulk_update_records(database: SqlClient, user_id: str, resource: str, updates: list[dict[str, Any]]) -> dict[str, Any]:
    updated = []
    errors = []
    for item in updates:
        try:
            updated.append(_update_record(database, user_id, resource, item["record_id"], item["changes"]))
        except (KeyError, TypeError, ValueError, ValidationError) as error:
            errors.append({"record_id": item.get("record_id"), "error": str(error)})
    return {"updated": updated, "errors": errors}



def delete_workspace_record(database: SqlClient, user: dict, resource: str, record_id: str) -> tuple[str, list[str]]:
    user_id = user["uid"]
    record_id = _clean_record_id(resource, record_id)
    if resource == "todos":
        deleted = todos.delete_todo(database, user_id, record_id)
    elif resource == "projects":
        deleted = ProjectRepository(database, user_id).delete(record_id)
    elif resource == "jobs":
        deleted = JobRepository(database, user_id).delete(record_id)
    elif resource == "hackathons":
        reference = database.collection("users").document(user_id).collection("hackathons").document(record_id)
        snapshot = reference.get()
        deleted = snapshot.exists
        if deleted:
            reference.update({
                "deleted": True,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": SERVER_TIMESTAMP,
            })
    elif resource == "documents":
        deleted = documents.delete_document(database, user_id, record_id)
    elif resource == "notifications":
        deleted = NotificationRepository(database, user_id).delete(record_id)
    else:
        raise ValueError("Unsupported workspace resource.")

    if not deleted:
        raise ValueError("Record not found.")
    return f"Soft deleted {resource} record {record_id}. It can be restored within 7 days.", [resource]



def restore_workspace_record(database: SqlClient, user: dict, resource: str, record_id: str) -> tuple[str, list[str]]:
    user_id = user["uid"]
    record_id = _clean_record_id(resource, record_id)
    if resource == "todos":
        restored = todos.restore_todo(database, user_id, record_id)
    elif resource == "projects":
        restored = ProjectRepository(database, user_id).restore(record_id)
    elif resource == "jobs":
        restored = JobRepository(database, user_id).restore(record_id)
    elif resource == "hackathons":
        reference = database.collection("users").document(user_id).collection("hackathons").document(record_id)
        snapshot = reference.get()
        restored = snapshot.exists
        if restored:
            reference.update({
                "deleted": False,
                "deleted_at": None,
                "updated_at": SERVER_TIMESTAMP,
            })
    elif resource == "documents":
        restored = documents.restore_document(database, user_id, record_id)
    elif resource == "notifications":
        restored = NotificationRepository(database, user_id).restore(record_id)
    else:
        raise ValueError("Unsupported workspace resource.")

    if not restored:
        raise ValueError("Record not found.")
    return f"Restored {resource} record {record_id}.", [resource]



