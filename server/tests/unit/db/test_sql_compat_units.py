"""Unit tests for the SQL compat registry and in-memory fallback store."""

from types import SimpleNamespace

import pytest

from app.db.sql.fallback import (
    delete_in_memory_doc,
    get_in_memory_doc,
    query_in_memory,
    set_in_memory_doc,
)
from app.db.sql.query import FieldFilter, SqlCollectionRef, SqlQuery, SqlSnapshot
from app.db.sql.registry import REGISTRY, _key_for_path, lookup


class TestRegistry:
    def test_every_registry_entry_has_full_operation_set(self):
        for key, entry in REGISTRY.items():
            for op in ("get", "set", "delete", "query"):
                assert entry.get(op) is not None, f"{key} missing {op}"

    def test_top_level_users_lookup(self):
        assert lookup(["users"], "get") is not None
        assert lookup(["users"], "set") is not None

    def test_top_level_calls_lookup(self):
        assert lookup(["calls"], "query") is not None

    def test_user_scoped_collections_resolve(self):
        for coll in ("todos", "jobs", "projects", "hackathons", "documents",
                     "contacts", "notifications", "eve_sessions", "eve_memories"):
            parts = ["users", "user-1", coll]
            for op in ("get", "set", "delete", "query"):
                assert lookup(parts, op) is not None, f"{coll} missing {op}"

    def test_unknown_collection_returns_none(self):
        assert lookup(["unknown_coll"], "get") is None

    def test_user_scoped_unknown_returns_none(self):
        assert lookup(["users", "u1", "unknown_coll"], "get") is None

    @pytest.mark.parametrize("parts", [
        ["users", "u1", "todos", "extra"],
        ["other", "u1", "todos"],
        [],
        ["users", "u1"],
    ])
    def test_malformed_paths_return_none(self, parts):
        assert _key_for_path(parts) is None or lookup(parts, "get") is None

    def test_unknown_op_returns_none(self):
        assert lookup(["users"], "explode") is None


class TestInMemoryStore:
    @pytest.fixture()
    def store(self):
        return {}

    def test_set_then_get(self, store):
        set_in_memory_doc(store, ["custom"], "doc-1", {"a": 1})
        snap = get_in_memory_doc(store, ["custom"], "doc-1")
        assert snap.exists is True
        assert snap.to_dict() == {"a": 1}

    def test_get_missing_returns_non_existing_snapshot(self, store):
        snap = get_in_memory_doc(store, ["custom"], "nope")
        assert snap.exists is False
        assert snap.to_dict() == {}

    def test_merge_updates_existing(self, store):
        set_in_memory_doc(store, ["c"], "d1", {"a": 1})
        set_in_memory_doc(store, ["c"], "d1", {"b": 2}, merge=True)
        assert get_in_memory_doc(store, ["c"], "d1").to_dict() == {"a": 1, "b": 2}

    def test_merge_creates_when_absent(self, store):
        set_in_memory_doc(store, ["c"], "new", {"b": 2}, merge=True)
        assert get_in_memory_doc(store, ["c"], "new").to_dict() == {"b": 2}

    def test_replace_overwrites_without_merge(self, store):
        set_in_memory_doc(store, ["c"], "d1", {"a": 1, "old": True})
        set_in_memory_doc(store, ["c"], "d1", {"a": 9}, merge=False)
        assert get_in_memory_doc(store, ["c"], "d1").to_dict() == {"a": 9}

    def test_delete_removes_and_is_idempotent(self, store):
        set_in_memory_doc(store, ["c"], "d1", {"a": 1})
        delete_in_memory_doc(store, ["c"], "d1")
        assert get_in_memory_doc(store, ["c"], "d1").exists is False
        delete_in_memory_doc(store, ["c"], "d1")  # no raise


def _client_for(store: dict) -> SimpleNamespace:
    """Minimal SqlClient stand-in routing queries to the in-memory fallback."""
    return SimpleNamespace(
        _in_memory_docs=store,
        _query_coll=lambda parts, q: query_in_memory(store, parts, q),
    )


class TestInMemoryQuery:
    @pytest.fixture()
    def populated(self):
        store = {}
        set_in_memory_doc(store, ["things"], "t1", {"name": "alpha", "n": 1})
        set_in_memory_doc(store, ["things"], "t2", {"name": "beta", "n": 2})
        set_in_memory_doc(store, ["things"], "t3", {"name": "gamma", "n": 3})
        # nested path must NOT match the parent collection query
        set_in_memory_doc(store, ["things", "t3", "sub"], "s1", {"name": "nested"})
        # different collection must not leak in
        set_in_memory_doc(store, ["other"], "o1", {"name": "zeta"})
        return store

    def _ref(self, populated) -> SqlCollectionRef:
        return SqlCollectionRef(_client_for(populated), ["things"])

    def test_stream_all_in_collection_only(self, populated):
        docs = self._ref(populated).stream()
        assert sorted(d.id for d in docs) == ["t1", "t2", "t3"]

    def test_equality_filter(self, populated):
        docs = self._ref(populated).where(filter=FieldFilter("name", "==", "beta")).stream()
        assert [d.id for d in docs] == ["t2"]

    def test_order_by_descending_with_limit(self, populated):
        docs = self._ref(populated).order_by("n", direction="DESCENDING").limit(2).stream()
        assert [d.id for d in docs] == ["t3", "t2"]

    def test_comparison_filters(self, populated):
        docs = self._ref(populated).where("n", ">=", 2).stream()
        assert sorted(d.id for d in docs) == ["t2", "t3"]

    def test_missing_field_never_matches_comparisons(self, populated):
        set_in_memory_doc(populated, ["things"], "t4", {"name": "delta"})  # no 'n'
        docs = self._ref(populated).where("n", ">", 0).stream()
        assert "t4" not in [d.id for d in docs]

    def test_not_equals_filter(self, populated):
        docs = self._ref(populated).where("name", "!=", "beta").stream()
        assert sorted(d.id for d in docs) == ["t1", "t3"]


class TestSqlSnapshot:
    def test_to_dict_returns_copy(self):
        snap = SqlSnapshot("id-1", {"k": "v"})
        out = snap.to_dict()
        out["mutated"] = True
        assert snap.to_dict() == {"k": "v"}

    def test_none_data_becomes_empty_dict(self):
        assert SqlSnapshot("id-1", None).to_dict() == {}


class TestQueryBuilderImmutability:
    def test_chaining_does_not_mutate_source_query(self):
        ref = SqlCollectionRef(_client_for({}), ["x"])
        base = SqlQuery(ref)
        filtered = base.where("a", "==", 1)
        limited = filtered.limit(5)

        assert base.filters == []
        assert base._limit is None
        assert len(filtered.filters) == 1
        assert limited._limit == 5
