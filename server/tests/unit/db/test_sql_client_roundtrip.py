"""Integration tests: SqlClient round-trips against the real SQLite test database.

Exercises the Firestore-compat surface (collection/document/where/order/limit)
through every registered entity handler backed by actual tables.
"""

import pytest

from app.db import FieldFilter, Query


@pytest.fixture()
def sql(db):
    """The real application SqlClient over a freshly-reset SQLite schema."""
    from tests.support.db import get_sql_client

    return get_sql_client()


class TestUserDocs:
    def test_set_get_round_trip(self, sql):
        doc = sql.collection("users").document("u-1")
        doc.set({"email": "u1@example.com", "display_name": "One"})
        snap = doc.get()
        assert snap.exists is True
        assert snap.to_dict()["email"] == "u1@example.com"

    def test_update_merges_fields(self, sql):
        doc = sql.collection("users").document("u-2")
        doc.set({"email": "u2@example.com", "display_name": "Two"})
        doc.update({"display_name": "Renamed"})
        assert doc.get().to_dict()["display_name"] == "Renamed"
        assert doc.get().to_dict()["email"] == "u2@example.com"

    def test_delete_then_missing(self, sql):
        doc = sql.collection("users").document("u-3")
        doc.set({"email": "u3@example.com"})
        doc.delete()
        assert doc.get().exists is False

    def test_query_by_email_filter(self, sql):
        users = sql.collection("users")
        users.document("ua").set({"email": "find-me@example.com"})
        users.document("ub").set({"email": "other@example.com"})

        hits = list(
            users.where(filter=FieldFilter("email", "==", "find-me@example.com")).stream()
        )
        assert [d.id for d in hits] == ["ua"]

    def test_document_autogenerates_id(self, sql):
        ref = sql.collection("users").document(None)
        assert ref.id  # uuid hex generated


class TestUserScopedTodos:
    def _coll(self, sql, uid="user-1"):
        return sql.collection("users").document(uid).collection("todos")

    def test_crud_round_trip(self, sql):
        coll = self._coll(sql)
        doc = coll.document("t-1")
        doc.set({"title": "Write tests", "completed": False})
        assert doc.get().to_dict()["title"] == "Write tests"

        doc.update({"completed": True})
        assert doc.get().to_dict()["completed"] is True

        doc.delete()
        assert doc.get().exists is False

    def test_filtered_query(self, sql):
        coll = self._coll(sql)
        coll.document("a").set({"title": "open", "completed": False, "created_at": "2026-08-01T00:00:00+00:00"})
        coll.document("b").set({"title": "done", "completed": True, "created_at": "2026-08-02T00:00:00+00:00"})

        open_docs = list(coll.where(filter=FieldFilter("completed", "==", False)).stream())
        assert [d.id for d in open_docs] == ["a"]

    def test_order_and_limit(self, sql):
        coll = self._coll(sql)
        # Create rows first, then stamp explicit created_at values (the create
        # branch uses server defaults, and same-tick inserts can tie).
        stamps = {"d0": "2026-08-01T00:00:00+00:00", "d1": "2026-08-03T00:00:00+00:00", "d2": "2026-08-02T00:00:00+00:00"}
        for doc_id in stamps:
            coll.document(doc_id).set({"title": f"task {doc_id}"})
        for doc_id, stamp in stamps.items():
            coll.document(doc_id).update({"created_at": stamp, "updated_at": stamp})

        latest = list(coll.order_by("created_at", direction=Query.DESCENDING).limit(2).stream())
        assert [d.id for d in latest] == ["d1", "d2"]

    def test_user_isolation(self, sql):
        """Handlers scope reads/writes by user: one user never sees another's docs."""
        alice = sql.collection("users").document("alice").collection("todos")
        bob = sql.collection("users").document("bob").collection("todos")
        alice.document("a-doc").set({"title": "alice task"})
        bob.document("b-doc").set({"title": "bob task"})

        # Each user sees only their own documents
        assert alice.document("a-doc").get().to_dict()["title"] == "alice task"
        assert alice.document("b-doc").get().exists is False
        assert bob.document("b-doc").get().to_dict()["title"] == "bob task"
        assert bob.document("a-doc").get().exists is False


class TestCallDocs:
    def test_call_round_trip_with_messages_json(self, sql):
        calls = sql.collection("calls")
        doc = calls.document("call-9")
        doc.set({
            "caller_id": "user-1",
            "receiver_id": "user-2",
            "status": "ringing",
            "messages": [{"role": "assistant", "content": "Hello"}],
        })
        data = doc.get().to_dict()
        assert data["status"] == "ringing"
        assert data["messages"][0]["content"] == "Hello"

    def test_participant_query_maps_to_caller_or_receiver(self, sql):
        calls = sql.collection("calls")
        calls.document("c1").set({"caller_id": "me", "receiver_id": "them", "status": "ended"})
        calls.document("c2").set({"caller_id": "someone", "receiver_id": "me", "status": "missed"})

        mine = list(calls.where(filter=FieldFilter("participants", "array_contains", "me")).stream())
        assert sorted(d.id for d in mine) == ["c1", "c2"]


class TestUnknownCollectionsUseMemoryFallback:
    def test_arbitrary_collection_stored_in_memory(self, sql):
        coll = sql.collection("totally_unknown")
        coll.document("x").set({"v": 42})
        snap = coll.document("x").get()
        assert snap.exists and snap.to_dict() == {"v": 42}

    def test_batch_commit_applies_operations(self, sql):
        batch = sql.batch()
        users = sql.collection("users")
        batch.set(users.document("b1"), {"email": "b1@x.com"})
        batch.set(users.document("b2"), {"email": "b2@x.com"})
        batch.commit()

        assert users.document("b1").get().exists
        assert users.document("b2").get().exists


class TestSettingsSubcollection:
    def test_user_settings_round_trip(self, sql):
        settings_coll = (
            sql.collection("users").document("user-1").collection("settings")
        )
        settings_coll.document("ai-models").set({"provider": "openai", "model": "gpt-x"})
        snap = settings_coll.document("ai-models").get()
        assert snap.to_dict() == {"provider": "openai", "model": "gpt-x"}




