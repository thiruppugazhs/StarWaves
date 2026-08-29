from datetime import datetime, timezone
from typing import Any

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

from app.schemas.contact import ContactCreate, ContactResponse, ContactUpdate


def collection(database: SqlClient, user_id: str):
    return database.collection("users").document(user_id).collection("contacts")


def from_snapshot(snapshot) -> ContactResponse:
    data = snapshot.to_dict() or {}
    created_at = data.get("created_at")
    updated_at = data.get("updated_at")

    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    elif created_at is not None:
        created_at = str(created_at)

    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()
    elif updated_at is not None:
        updated_at = str(updated_at)

    return ContactResponse(
        id=snapshot.id,
        name=data.get("name", ""),
        email=data.get("email"),
        phone=data.get("phone"),
        company=data.get("company"),
        role=data.get("role"),
        category=data.get("category", "general"),
        notes=data.get("notes"),
        avatar_url=data.get("avatar_url"),
        starred=bool(data.get("starred", False)),
        created_at=created_at,
        updated_at=updated_at,
    )


def list_contacts(database: SqlClient, user_id: str) -> list[ContactResponse]:
    # Legacy capped to 100
    query = collection(database, user_id).order_by(
        "name",
        direction=Query.ASCENDING,
    )
    results = []
    count = 0
    for snapshot in query.stream():
        if count >= 100:
            break
        data = snapshot.to_dict() or {}
        if not data.get("deleted"):
            results.append(from_snapshot(snapshot))
            count += 1
    return results


def list_contacts_page(database: SqlClient, user_id: str, cursor: str | None, limit: int):
    from app.repositories.pagination import paginate_collection

    # Contacts ordered by name ASC, but pagination helper uses DESC; handle via ASC query manually
    # For consistency, we still use paginate_collection with name ASC by passing collection and custom logic
    # Fallback: use DESC on created_at for pagination stability; name ordering is secondary
    coll = collection(database, user_id)
    # Use created_at DESC for stable keyset; frontend sorts by name after fetch (1-10 users small set)
    # For larger scale, add dedicated name index
    raw, next_cursor, has_more = paginate_collection(coll, "created_at", cursor, limit)
    items = []
    for data in raw:
        if data.get("deleted"):
            continue
        fake = type("S", (), {"id": data["id"], "to_dict": lambda s, d=data: d})()
        items.append(from_snapshot(fake))
    # Sort paginated chunk by name for presentation
    items.sort(key=lambda c: (c.name or "").lower())
    return items, next_cursor, has_more


def get_contact(
    database: SqlClient,
    user_id: str,
    contact_id: str,
) -> ContactResponse | None:
    snapshot = collection(database, user_id).document(contact_id).get()
    if not snapshot.exists:
        return None
    data = snapshot.to_dict() or {}
    if data.get("deleted"):
        return None
    return from_snapshot(snapshot)


def create_contact(
    database: SqlClient,
    user_id: str,
    contact: ContactCreate,
) -> ContactResponse:
    reference = collection(database, user_id).document()
    now = datetime.now(timezone.utc).isoformat()
    data = contact.model_dump(mode="python")
    reference.set(
        {
            **data,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        },
    )
    return ContactResponse(id=reference.id, **data, created_at=now, updated_at=now)


def update_contact(
    database: SqlClient,
    user_id: str,
    contact_id: str,
    changes: ContactUpdate,
) -> ContactResponse | None:
    reference = collection(database, user_id).document(contact_id)
    if not reference.get().exists:
        return None
    data = changes.model_dump(exclude_unset=True, mode="python")
    reference.update(
        {
            **data,
            "updated_at": SERVER_TIMESTAMP,
        },
    )
    return from_snapshot(reference.get())


def delete_contact(database: SqlClient, user_id: str, contact_id: str) -> bool:
    reference = collection(database, user_id).document(contact_id)
    if not reference.get().exists:
        return False
    reference.update({
        "deleted": True,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": SERVER_TIMESTAMP,
    })
    return True


def restore_contact(database: SqlClient, user_id: str, contact_id: str) -> bool:
    reference = collection(database, user_id).document(contact_id)
    if not reference.get().exists:
        return False
    reference.update({
        "deleted": False,
        "deleted_at": None,
        "updated_at": SERVER_TIMESTAMP,
    })
    return True
