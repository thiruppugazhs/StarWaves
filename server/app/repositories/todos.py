from datetime import datetime, timezone

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

from app.repositories.helpers import dict_to_snapshot, restore_payload, soft_delete_payload
from app.schemas.todo import TodoCreate, TodoResponse, TodoUpdate


def collection(database: SqlClient, user_id: str):
    return database.collection("users").document(user_id).collection("todos")


def from_snapshot(snapshot) -> TodoResponse:
    data = dict(snapshot.to_dict() or {})
    data.pop("id", None)
    return TodoResponse(id=snapshot.id, **data)


def values_for_firestore(values: dict) -> dict:
    if values.get("due_date") is not None:
        values["due_date"] = values["due_date"].isoformat()
    return values


def list_todos(database: SqlClient, user_id: str) -> list[TodoResponse]:
    # Legacy: full fetch capped to 100 for safety; prefer paginated endpoint
    query = collection(database, user_id).order_by(
        "created_at",
        direction=Query.DESCENDING,
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


def list_todos_page(database: SqlClient, user_id: str, cursor: str | None, limit: int):
    from app.repositories.pagination import paginate_collection

    coll = collection(database, user_id)
    raw, next_cursor, has_more = paginate_collection(coll, "created_at", cursor, limit)
    items = []
    for data in raw:
        if data.get("deleted"):
            continue
        items.append(from_snapshot(dict_to_snapshot(data)))
    return items, next_cursor, has_more


def get_todo(
    database: SqlClient,
    user_id: str,
    todo_id: str,
) -> TodoResponse | None:
    snapshot = collection(database, user_id).document(todo_id).get()
    if not snapshot.exists:
        return None
    data = snapshot.to_dict() or {}
    if data.get("deleted"):
        return None
    return from_snapshot(snapshot)


def create_todo(
    database: SqlClient,
    user_id: str,
    todo: TodoCreate,
) -> TodoResponse:
    reference = collection(database, user_id).document()
    now = datetime.now(timezone.utc).isoformat()
    data = values_for_firestore(todo.model_dump(mode="python"))
    reference.set(
        {
            **data,
            "created_at": SERVER_TIMESTAMP,
            "updated_at": SERVER_TIMESTAMP,
        },
    )
    return TodoResponse(id=reference.id, **data, created_at=now, updated_at=now)


def update_todo(
    database: SqlClient,
    user_id: str,
    todo_id: str,
    changes: TodoUpdate,
) -> TodoResponse | None:
    reference = collection(database, user_id).document(todo_id)
    if not reference.get().exists:
        return None
    reference.update(
        {
            **values_for_firestore(
                changes.model_dump(exclude_unset=True, mode="python"),
            ),
            "updated_at": SERVER_TIMESTAMP,
        },
    )
    return from_snapshot(reference.get())


def delete_todo(database: SqlClient, user_id: str, todo_id: str) -> bool:
    reference = collection(database, user_id).document(todo_id)
    if not reference.get().exists:
        return False
    reference.update(soft_delete_payload())
    return True


def restore_todo(database: SqlClient, user_id: str, todo_id: str) -> bool:
    reference = collection(database, user_id).document(todo_id)
    if not reference.get().exists:
        return False
    reference.update(restore_payload())
    return True

