from datetime import datetime, timezone
from typing import Any

from app.db import ArrayUnion, Query, SERVER_TIMESTAMP, SqlClient

DEFAULT_TITLE = "New chat"
STARTER_MESSAGE = {
    "role": "assistant",
    "content": "Hi, I\u2019m Eve. I can read, create, update, delete, and restore your workspace records.",
}
MAX_TITLE_LENGTH = 48
MAX_PREVIEW_LENGTH = 60


def sessions_collection(database: SqlClient, user_id: str):
    return database.collection("users").document(user_id).collection("eve_sessions")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1].rstrip()}\u2026"


def _first_user_message(messages: list[dict[str, Any]]) -> str | None:
    for message in messages:
        if message.get("role") == "user" and message.get("content"):
            return message["content"]
    return None


def _derive_title(messages: list[dict[str, Any]]) -> str:
    first = _first_user_message(messages)
    return _clip(first, MAX_TITLE_LENGTH) if first else DEFAULT_TITLE


def _preview(messages: list[dict[str, Any]]) -> str:
    for message in reversed(messages):
        if message.get("content"):
            return _clip(message["content"], MAX_PREVIEW_LENGTH)
    return DEFAULT_TITLE


def list_sessions(database: SqlClient, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    documents = (
        sessions_collection(database, user_id)
        .order_by("updated_at", direction=Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    sessions = []
    for item in documents:
        data = item.to_dict() or {}
        sessions.append(
            {
                "id": item.id,
                "title": data.get("title", DEFAULT_TITLE),
                "updated_at": data.get("updated_at", ""),
                "preview": _preview(data.get("messages", [])),
            }
        )
    return sessions


def create_session(
    database: SqlClient,
    user_id: str,
    messages: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    messages = messages or [STARTER_MESSAGE]
    reference = sessions_collection(database, user_id).document()
    now = _now()
    data = {
        "title": _derive_title(messages),
        "messages": messages,
        "created_at": now,
        "updated_at": now,
    }
    reference.set(data)
    return {"id": reference.id, **data}


def get_session(database: SqlClient, user_id: str, session_id: str) -> dict[str, Any]:
    reference = sessions_collection(database, user_id).document(session_id)
    snapshot = reference.get()
    if not snapshot.exists:
        raise ValueError("Session not found.")
    return {"id": session_id, **(snapshot.to_dict() or {})}


def save_messages(
    database: SqlClient,
    user_id: str,
    session_id: str,
    messages: list[dict[str, Any]],
) -> dict[str, Any]:
    reference = sessions_collection(database, user_id).document(session_id)
    snapshot = reference.get()
    if not snapshot.exists:
        raise ValueError("Session not found.")
    current = snapshot.to_dict() or {}
    title = current.get("title", DEFAULT_TITLE)
    if title == DEFAULT_TITLE:
        title = _derive_title(messages)
    now = _now()
    reference.update({"title": title, "messages": messages, "updated_at": now})
    return {
        "id": session_id,
        "title": title,
        "created_at": current.get("created_at", now),
        "updated_at": now,
        "messages": messages,
    }


def delete_session(database: SqlClient, user_id: str, session_id: str) -> bool:
    reference = sessions_collection(database, user_id).document(session_id)
    if not reference.get().exists:
        return False
    reference.delete()
    return True
