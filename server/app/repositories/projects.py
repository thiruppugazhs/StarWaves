"""Project repository: workspace project CRUD against Firestore."""

from datetime import datetime, timezone
from typing import Any

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

from app.repositories.helpers import restore_payload, soft_delete_payload
from app.repositories.pagination import paginate_collection, serialize_dates, user_collection
from app.schemas.workspace import ProjectCreate


class ProjectRepository:
    def __init__(self, database: SqlClient, user_id: str):
        self.database = database
        self.user_id = user_id
        self.collection = user_collection(database, user_id, "projects")

    def list_page(self, cursor: str | None, limit: int):
        return paginate_collection(self.collection, "created_at", cursor, limit)

    def get(self, project_id: str) -> dict[str, Any] | None:
        snapshot = self.collection.document(project_id).get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict() or {}
        if data.get("deleted"):
            return None
        return {"id": snapshot.id, **data}

    def create(self, project: ProjectCreate) -> dict[str, Any]:
        reference = self.collection.document()
        now = datetime.now(timezone.utc).isoformat()
        data = serialize_dates(project.model_dump(mode="python"))
        reference.set(
            {
                **data,
                "created_at": SERVER_TIMESTAMP,
                "updated_at": SERVER_TIMESTAMP,
            },
        )
        return {"id": reference.id, **data, "created_at": now, "updated_at": now}

    def update(self, project_id: str, project: ProjectCreate) -> dict[str, Any] | None:
        reference = self.collection.document(project_id)
        try:
            reference.update(
                {
                    **serialize_dates(project.model_dump(mode="python")),
                    "updated_at": SERVER_TIMESTAMP,
                },
            )
        except Exception:
            return None
        return {"id": reference.id, **(reference.get().to_dict() or {})}

    def patch(self, project_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        reference = self.collection.document(project_id)
        now = datetime.now(timezone.utc).isoformat()
        serialized = serialize_dates(updates)
        try:
            snapshot = reference.get()
            if not snapshot.exists:
                # Prevent PATCH from creating/overwriting foreign global PK (BOLA)
                # Check if doc exists globally for any user — if so, don't create via attacker's collection
                from app.db.session import sync_engine
                from sqlalchemy.orm import Session
                from app.models import Project

                with Session(sync_engine) as session:
                    if session.get(Project, project_id) is not None:
                        return None
                base_data = {
                    "name": updates.get("name") or project_id,
                    "description": updates.get("description") or "",
                    "status": updates.get("status") or "Active",
                    "progress": updates.get("progress") or 0,
                    "members": updates.get("members") or 1,
                    "technologies": updates.get("technologies") or [],
                    "github_url": updates.get("github_url"),
                    "live_url": updates.get("live_url"),
                    "lifecycle_phase": updates.get("lifecycle_phase") or "idea",
                    "created_at": SERVER_TIMESTAMP,
                    "updated_at": SERVER_TIMESTAMP,
                    **serialized,
                }
                reference.set(base_data)
                return {"id": reference.id, **base_data, "created_at": now, "updated_at": now}

            reference.update(
                {
                    **serialized,
                    "updated_at": SERVER_TIMESTAMP,
                },
            )
        except Exception:
            return None
        return {"id": reference.id, **(reference.get().to_dict() or {})}

    def delete(self, project_id: str) -> bool:
        reference = self.collection.document(project_id)
        if not reference.get().exists:
            return False
        reference.update(soft_delete_payload())
        return True

    def restore(self, project_id: str) -> bool:
        reference = self.collection.document(project_id)
        if not reference.get().exists:
            return False
        reference.update(restore_payload())
        return True
