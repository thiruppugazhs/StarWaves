"""In-memory fallback document store for non-table collections and test mocks."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.db.sql.query import SqlSnapshot

if TYPE_CHECKING:
    from app.db.sql.query import SqlQuery


def get_in_memory_doc(
    in_memory_docs: dict[str, dict[str, Any]],
    path_parts: list[str],
    doc_id: str,
) -> SqlSnapshot:
    """Fetch document from in-memory fallback dictionary."""
    key = "/".join([*path_parts, doc_id])
    if key in in_memory_docs:
        return SqlSnapshot(doc_id, dict(in_memory_docs[key]), exists=True)
    return SqlSnapshot(doc_id, None, exists=False)


def set_in_memory_doc(
    in_memory_docs: dict[str, dict[str, Any]],
    path_parts: list[str],
    doc_id: str,
    data: dict[str, Any],
    merge: bool = False,
) -> None:
    """Save or update document in in-memory fallback dictionary."""
    key = "/".join([*path_parts, doc_id])
    if merge and key in in_memory_docs:
        in_memory_docs[key].update(data)
    else:
        in_memory_docs[key] = dict(data)


def delete_in_memory_doc(
    in_memory_docs: dict[str, dict[str, Any]],
    path_parts: list[str],
    doc_id: str,
) -> None:
    """Remove document from in-memory fallback dictionary."""
    key = "/".join([*path_parts, doc_id])
    in_memory_docs.pop(key, None)


def query_in_memory(
    in_memory_docs: dict[str, dict[str, Any]],
    path_parts: list[str],
    query: SqlQuery,
) -> list[SqlSnapshot]:
    """Execute filter and sort query against in-memory fallback collection."""
    prefix = "/".join(path_parts) + "/"
    matching_docs: list[SqlSnapshot] = []
    for k, doc_data in in_memory_docs.items():
        if not k.startswith(prefix):
            continue
        remainder = k[len(prefix):]
        if "/" in remainder:
            continue
        doc_id = remainder
        doc_dict = dict(doc_data)
        match = True
        for field, op, val in query.filters:
            field_val = doc_dict.get(field)
            if op in ("==", "=") and field_val != val:
                match = False
                break
            if op == "!=" and field_val == val:
                match = False
                break
            if op in ("<", "<=", ">", ">="):
                if field_val is None:
                    match = False
                    break
                fv_str = field_val.isoformat() if hasattr(field_val, "isoformat") else str(field_val)
                val_str = val.isoformat() if hasattr(val, "isoformat") else str(val)
                if op == "<" and not (fv_str < val_str):
                    match = False
                    break
                if op == "<=" and not (fv_str <= val_str):
                    match = False
                    break
                if op == ">" and not (fv_str > val_str):
                    match = False
                    break
                if op == ">=" and not (fv_str >= val_str):
                    match = False
                    break
        if match:
            matching_docs.append(SqlSnapshot(doc_id, doc_dict, exists=True))

    if query._order_by:
        reverse = query._direction == "DESC"
        matching_docs.sort(
            key=lambda s: str(s._data.get(query._order_by) or ""),
            reverse=reverse,
        )

    if query._limit:
        matching_docs = matching_docs[:query._limit]

    return matching_docs
