from datetime import datetime, timezone

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

from app.schemas.document import DocumentResponse, DocumentUpsert


def _collection(database: SqlClient, user_id: str):
    return database.collection("users").document(user_id).collection("documents")


def _from_snapshot(snapshot) -> DocumentResponse:
    data = dict(snapshot.to_dict() or {})
    data.setdefault("id", snapshot.id)
    data.setdefault("name", data.get("title") or "Untitled")
    data.setdefault("url", data.get("url") or "")
    data.setdefault("category", data.get("folder") or "General")
    data.setdefault("description", data.get("content") or "")
    data.setdefault("type", "FILE")
    data.setdefault("size", "Unknown")
    data.setdefault("modified_at", data.get("updated_at") or data.get("created_at") or datetime.now(timezone.utc).isoformat())
    return DocumentResponse(**data)


def list_documents(database: SqlClient, user_id: str) -> list[DocumentResponse]:
    # Legacy capped to 100 for e2-micro safety
    query = _collection(database, user_id).order_by(
        "modified_at",
        direction=Query.DESCENDING,
    )
    results = []
    count = 0
    for snapshot in query.stream():
        if count >= 100:
            break
        data = snapshot.to_dict() or {}
        if not data.get("deleted"):
            results.append(_from_snapshot(snapshot))
            count += 1
    return results


def list_documents_page(database: SqlClient, user_id: str, cursor: str | None, limit: int):
    from app.repositories.pagination import paginate_collection

    coll = _collection(database, user_id)
    raw, next_cursor, has_more = paginate_collection(coll, "modified_at", cursor, limit)
    items = []
    for data in raw:
        if data.get("deleted"):
            continue
        fake = type("S", (), {"id": data["id"], "to_dict": lambda s, d=data: d})()
        items.append(_from_snapshot(fake))
    return items, next_cursor, has_more


def get_document(
    database: SqlClient,
    user_id: str,
    document_id: str,
) -> DocumentResponse | None:
    snapshot = _collection(database, user_id).document(document_id).get()
    if not snapshot.exists:
        return None
    data = snapshot.to_dict() or {}
    if data.get("deleted"):
        return None
    return _from_snapshot(snapshot)


def upsert_document(
    database: SqlClient,
    user_id: str,
    document_id: str,
    document: DocumentUpsert,
) -> DocumentResponse:
    reference = _collection(database, user_id).document(document_id)
    existing = reference.get()
    now = datetime.now(timezone.utc).isoformat()
    data = document.model_dump(mode="python")
    values = {
        **data,
        "updated_at": SERVER_TIMESTAMP,
    }
    if not existing.exists:
        values["created_at"] = SERVER_TIMESTAMP
    reference.set(values, merge=True)
    return DocumentResponse(
        id=document_id,
        **data,
        updated_at=now,
        created_at=existing.to_dict().get("created_at", now) if existing.exists else now,
    )


def delete_document(database: SqlClient, user_id: str, document_id: str) -> bool:
    reference = _collection(database, user_id).document(document_id)
    if not reference.get().exists:
        return False
    reference.update({
        "deleted": True,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": SERVER_TIMESTAMP,
    })
    return True


def restore_document(database: SqlClient, user_id: str, document_id: str) -> bool:
    reference = _collection(database, user_id).document(document_id)
    if not reference.get().exists:
        return False
    reference.update({
        "deleted": False,
        "deleted_at": None,
        "updated_at": SERVER_TIMESTAMP,
    })
    return True

