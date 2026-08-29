"""Account deletion: removal of a user document and all known subcollections.

The SQL compat layer exposes no dynamic ``.collections()`` enumerator (a
Firestore-only API), so deletion walks the fixed set of user-scoped
subcollections defined by ``db/sql/registry.py`` plus the special-cased
WhatsApp/settings paths handled inside ``SqlClient``.
"""

from app.db import SqlClient

from app.repositories.users import get_users_collection

# Every subcollection the app ever creates under users/{uid}.
USER_SUBCOLLECTIONS = [
    "todos",
    "jobs",
    "projects",
    "hackathons",
    "documents",
    "contacts",
    "notifications",
    "eve_sessions",
    "eve_memories",
    "settings",
    "integrations",
    "whatsapp_chats",
]

# Subcollections nested one level deeper that must be cleared before their parent.
_NESTED_CHILDREN = {"whatsapp_chats": "messages"}


def _delete_collection_recursively(database: SqlClient, collection_ref) -> None:
    """Delete every document in a collection, clearing known nested children first."""
    parts = list(collection_ref.path_parts)
    nested_child = _NESTED_CHILDREN.get(parts[-1]) if len(parts) >= 3 else None
    for snapshot in list(collection_ref.stream()):
        doc_ref = collection_ref.document(snapshot.id)
        if nested_child:
            _delete_collection_recursively(database, doc_ref.collection(nested_child))
        doc_ref.delete()


def delete_user_account(database: SqlClient, uid: str) -> bool:
    document_ref = get_users_collection(database).document(uid)
    if not document_ref.get().exists:
        return False
    for subcollection in USER_SUBCOLLECTIONS:
        _delete_collection_recursively(database, document_ref.collection(subcollection))
    document_ref.delete()
    return True
