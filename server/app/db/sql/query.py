"""Query, collection, document reference, and batch emulation objects for Firestore compatibility."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.db.sql.client import SqlClient


class FieldFilter:
    """Filter specification emulating Firestore's FieldFilter."""

    def __init__(self, field_path: str, op_string: str, value: Any):
        self.field_path = field_path
        self.op_string = op_string
        self.value = value


class Query:
    """Query constants for order_by directions."""

    DESCENDING = "DESCENDING"
    ASCENDING = "ASCENDING"


class SqlSnapshot:
    """Represents an immutable snapshot of a document."""

    def __init__(self, doc_id: str, data: dict[str, Any] | None, exists: bool = True):
        self.id = doc_id
        self._data = data or {}
        self.exists = exists

    def to_dict(self) -> dict[str, Any]:
        return dict(self._data)


class SqlDocRef:
    """Document reference representing a specific path in the document hierarchy."""

    def __init__(self, db: SqlClient, path_parts: list[str], doc_id: str):
        self.db = db
        self.path_parts = path_parts
        self.id = doc_id

    @property
    def reference(self) -> SqlDocRef:
        return self

    def collection(self, name: str) -> SqlCollectionRef:
        return SqlCollectionRef(self.db, [*self.path_parts, self.id, name])

    def get(self) -> SqlSnapshot:
        return self.db._get_doc(self.path_parts, self.id)

    def set(self, data: dict[str, Any], merge: bool = False) -> None:
        self.db._set_doc(self.path_parts, self.id, data, merge=merge)

    def update(self, updates: dict[str, Any]) -> None:
        self.db._update_doc(self.path_parts, self.id, updates)

    def delete(self) -> None:
        self.db._delete_doc(self.path_parts, self.id)


class SqlQuery:
    """Query builder supporting chaining of where, order_by, limit, and start_after."""

    def __init__(self, coll: SqlCollectionRef):
        self.coll = coll
        self.filters: list[tuple[str, str, Any]] = []
        self._order_by: str | None = None
        self._direction: str = "ASC"
        self._limit: int | None = None
        self._start_after_doc_id: str | None = None

    def where(
        self,
        field_or_filter: Any = None,
        op: str | None = None,
        value: Any = None,
        filter: Any = None,
    ) -> SqlQuery:
        q = SqlQuery(self.coll)
        q.filters = list(self.filters)
        q._order_by = self._order_by
        q._direction = self._direction
        q._limit = self._limit
        q._start_after_doc_id = self._start_after_doc_id

        actual_filter = filter if filter is not None else field_or_filter
        if op is None and hasattr(actual_filter, "field_path"):
            q.filters.append((actual_filter.field_path, actual_filter.op_string, actual_filter.value))
        elif hasattr(actual_filter, "field_name"):
            q.filters.append(
                (
                    getattr(actual_filter, "field_name"),
                    getattr(actual_filter, "operator", "=="),
                    getattr(actual_filter, "value"),
                )
            )
        elif op is not None and actual_filter is not None:
            q.filters.append((str(actual_filter), op, value))
        return q

    def order_by(self, field: str, direction: Any = None) -> SqlQuery:
        q = SqlQuery(self.coll)
        q.filters = list(self.filters)
        q._order_by = field
        q._direction = (
            "DESC"
            if str(direction).lower() in ("descending", "desc", "query.descending") or "DESC" in str(direction)
            else "ASC"
        )
        q._limit = self._limit
        q._start_after_doc_id = self._start_after_doc_id
        return q

    def limit(self, count: int) -> SqlQuery:
        q = SqlQuery(self.coll)
        q.filters = list(self.filters)
        q._order_by = self._order_by
        q._direction = self._direction
        q._limit = count
        q._start_after_doc_id = self._start_after_doc_id
        return q

    def start_after(self, doc_or_snap: Any) -> SqlQuery:
        q = SqlQuery(self.coll)
        q.filters = list(self.filters)
        q._order_by = self._order_by
        q._direction = self._direction
        q._limit = self._limit
        q._start_after_doc_id = getattr(doc_or_snap, "id", str(doc_or_snap))
        return q

    def stream(self) -> list[SqlSnapshot]:
        return self.coll.db._query_coll(self.coll.path_parts, self)


class SqlCollectionRef:
    """Collection reference pointing to a collection path in the document hierarchy."""

    def __init__(self, db: SqlClient, path_parts: list[str]):
        self.db = db
        self.path_parts = path_parts

    def document(self, doc_id: str | None = None) -> SqlDocRef:
        target_id = doc_id or uuid.uuid4().hex
        return SqlDocRef(self.db, self.path_parts, target_id)

    def where(
        self,
        field_or_filter: Any = None,
        op: str | None = None,
        value: Any = None,
        filter: Any = None,
    ) -> SqlQuery:
        return SqlQuery(self).where(field_or_filter, op, value, filter=filter)

    def order_by(self, field: str, direction: Any = None) -> SqlQuery:
        return SqlQuery(self).order_by(field, direction)

    def limit(self, count: int) -> SqlQuery:
        return SqlQuery(self).limit(count)

    def stream(self) -> list[SqlSnapshot]:
        return SqlQuery(self).stream()


class SqlBatch:
    """Batched write operations for atomic commit emulation."""

    def __init__(self, db: SqlClient):
        self.db = db
        self.operations: list[tuple[str, SqlDocRef, dict[str, Any]]] = []

    def set(self, doc_ref: SqlDocRef, data: dict[str, Any], merge: bool = False) -> None:
        self.operations.append(("set", doc_ref, data))

    def update(self, doc_ref: SqlDocRef, updates: dict[str, Any]) -> None:
        self.operations.append(("update", doc_ref, updates))

    def delete(self, doc_ref: SqlDocRef) -> None:
        self.operations.append(("delete", doc_ref, {}))

    def commit(self) -> None:
        for op, doc_ref, data in self.operations:
            if op == "set":
                doc_ref.set(data)
            elif op == "update":
                doc_ref.update(data)
            elif op == "delete":
                doc_ref.delete()
        self.operations.clear()
