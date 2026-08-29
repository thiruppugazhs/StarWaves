"""SQL client adapter dispatching Firestore operations to modular SQL handlers."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.sql._shared import clean_data
from app.db.sql.fallback import (
    delete_in_memory_doc,
    get_in_memory_doc,
    query_in_memory,
    set_in_memory_doc,
)
from app.db.sql.query import SqlBatch, SqlCollectionRef, SqlQuery, SqlSnapshot
from app.db.sql.registry import lookup as registry_lookup
from app.models import User
from app.db.sql.settings import (
    delete_setting_doc,
    get_setting_doc,
    set_setting_doc,
)
from app.db.sql.whatsapp import (
    delete_whatsapp_chat_doc,
    delete_whatsapp_message_doc,
    get_whatsapp_chat_doc,
    get_whatsapp_message_doc,
    query_whatsapp_chats,
    query_whatsapp_messages,
    set_whatsapp_chat_doc,
    set_whatsapp_message_doc,
)


class SqlClient:
    """PostgreSQL/SQLAlchemy-backed Firestore Client adapter."""

    def __init__(self):
        from app.db.session import sync_engine
        self._sync_engine = sync_engine
        self._in_memory_docs: dict[str, dict[str, Any]] = {}

    def collection(self, name: str) -> SqlCollectionRef:
        """Create a collection reference for a top-level collection."""
        return SqlCollectionRef(self, [name])

    def collection_group(self, name: str) -> SqlCollectionRef:
        """Create a collection group reference."""
        return SqlCollectionRef(self, ["__group__", name])

    def batch(self) -> SqlBatch:
        """Create a batched write instance."""
        return SqlBatch(self)

    def _get_doc(self, path_parts: list[str], doc_id: str) -> SqlSnapshot:
        """Route document retrieval to the matching entity handler (registry-driven)."""
        with Session(self._sync_engine) as session:
            handler = registry_lookup(path_parts, "get")
            if handler is not None:
                # handler signature: (session, user_id?, doc_id) or (session, doc_id)
                if len(path_parts) == 1:
                    return handler(session, doc_id)
                return handler(session, path_parts[1], doc_id)

            # settings have extra category dimension not in registry
            if len(path_parts) == 3 and path_parts[0] == "users" and path_parts[2] in ("settings", "integrations"):
                return get_setting_doc(session, path_parts[1], path_parts[2], doc_id)
            if len(path_parts) == 3 and path_parts[0] == "users" and path_parts[2] == "whatsapp_chats":
                return get_whatsapp_chat_doc(session, path_parts[1], doc_id)
            if len(path_parts) == 5 and path_parts[0] == "users" and path_parts[2] == "whatsapp_chats" and path_parts[4] == "messages":
                return get_whatsapp_message_doc(session, path_parts[1], path_parts[3], doc_id)

        return get_in_memory_doc(self._in_memory_docs, path_parts, doc_id)

    def _set_doc(
        self,
        path_parts: list[str],
        doc_id: str,
        data: dict[str, Any],
        merge: bool = False,
    ) -> None:
        """Route document set/update to the matching entity handler (registry-driven)."""
        data = clean_data(data)
        with Session(self._sync_engine) as session:
            handler = registry_lookup(path_parts, "set")
            if handler is not None:
                if len(path_parts) == 1:
                    handler(session, doc_id, data, merge=merge)
                else:
                    handler(session, path_parts[1], doc_id, data, merge=merge)
                return
            if len(path_parts) == 3 and path_parts[0] == "users" and path_parts[2] in ("settings", "integrations"):
                set_setting_doc(session, path_parts[1], path_parts[2], doc_id, data, merge=merge)
                return
            if len(path_parts) == 3 and path_parts[0] == "users" and path_parts[2] == "whatsapp_chats":
                set_whatsapp_chat_doc(session, path_parts[1], doc_id, data, merge=merge)
                return
            if len(path_parts) == 5 and path_parts[0] == "users" and path_parts[2] == "whatsapp_chats" and path_parts[4] == "messages":
                set_whatsapp_message_doc(session, path_parts[1], path_parts[3], doc_id, data, merge=merge)
                return

        set_in_memory_doc(self._in_memory_docs, path_parts, doc_id, data, merge=merge)

    def _update_doc(self, path_parts: list[str], doc_id: str, updates: dict[str, Any]) -> None:
        """Update document fields with merge=True."""
        self._set_doc(path_parts, doc_id, updates, merge=True)

    def _delete_doc(self, path_parts: list[str], doc_id: str) -> None:
        """Route document deletion to the matching entity handler (registry-driven)."""
        delete_in_memory_doc(self._in_memory_docs, path_parts, doc_id)
        with Session(self._sync_engine) as session:
            handler = registry_lookup(path_parts, "delete")
            if handler is not None:
                if len(path_parts) >= 2 and path_parts[0] == "users":
                    # Handlers are (session, doc_id, user_id=None) — doc_id first.
                    handler(session, doc_id, path_parts[1])
                    return
                handler(session, doc_id)
                return
            if len(path_parts) == 3 and path_parts[0] == "users" and path_parts[2] in ("settings", "integrations"):
                delete_setting_doc(session, path_parts[1], path_parts[2], doc_id)
            elif len(path_parts) == 3 and path_parts[0] == "users" and path_parts[2] == "whatsapp_chats":
                delete_whatsapp_chat_doc(session, doc_id)
            elif len(path_parts) == 5 and path_parts[0] == "users" and path_parts[2] == "whatsapp_chats" and path_parts[4] == "messages":
                delete_whatsapp_message_doc(session, doc_id)

    def _query_coll(self, path_parts: list[str], query: SqlQuery) -> list[SqlSnapshot]:
        """Route collection queries to the matching entity handler (registry-driven)."""
        with Session(self._sync_engine) as session:
            # Collection-group queries (Firestore semantics): fan out to the
            # per-user handler for every user, bounded by the users table size.
            if len(path_parts) == 2 and path_parts[0] == "__group__":
                coll = path_parts[1]
                results: list[SqlSnapshot] = []
                user_ids = session.execute(select(User.id)).scalars().all()
                for uid in user_ids:
                    parts = ["users", uid, coll]
                    handler = registry_lookup(parts, "query")
                    if handler is not None:
                        results.extend(handler(session, uid, query))
                return results
            handler = registry_lookup(path_parts, "query")
            if handler is not None:
                if len(path_parts) == 1:
                    return handler(session, query)
                return handler(session, path_parts[1], query)
            if len(path_parts) == 3 and path_parts[0] == "users" and path_parts[2] == "whatsapp_chats":
                return query_whatsapp_chats(session, path_parts[1], query)
            if len(path_parts) == 5 and path_parts[0] == "users" and path_parts[2] == "whatsapp_chats" and path_parts[4] == "messages":
                return query_whatsapp_messages(session, path_parts[1], path_parts[3], query)
        return query_in_memory(self._in_memory_docs, path_parts, query)


_sql_client_instance: SqlClient | None = None


def get_db_client() -> SqlClient:
    """Get or create singleton SqlClient instance."""
    global _sql_client_instance
    if _sql_client_instance is None:
        _sql_client_instance = SqlClient()
    return _sql_client_instance


def get_firestore() -> SqlClient:
    """Alias for get_db_client for backward compatibility across existing routes."""
    return get_db_client()
