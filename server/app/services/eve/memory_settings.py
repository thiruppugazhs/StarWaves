"""Eve memory settings — single responsibility: auto-remember preference persistence.

Stored at Firestore-shaped doc ``users/{uid}/settings/eve-memory`` (SQL compat layer
maps it to the ``user_settings`` table). Default is ON per product decision.
"""

from app.db import SqlClient

EVE_MEMORY_SETTINGS_DOC = "eve-memory"
DEFAULT_AUTO_REMEMBER = True


def _reference(database: SqlClient, user_id: str):
    return (
        database.collection("users")
        .document(user_id)
        .collection("settings")
        .document(EVE_MEMORY_SETTINGS_DOC)
    )


def load_memory_settings(database: SqlClient, user_id: str) -> dict:
    """Load raw settings dict; empty dict when unset."""
    snapshot = _reference(database, user_id).get()
    if not snapshot.exists:
        return {}
    return snapshot.to_dict() or {}


def resolve_auto_remember(database: SqlClient, user_id: str) -> bool:
    """Resolve the auto-remember toggle; defaults to ON when never saved."""
    data = load_memory_settings(database, user_id)
    value = data.get("auto_remember")
    if value is None:
        return DEFAULT_AUTO_REMEMBER
    return bool(value)
