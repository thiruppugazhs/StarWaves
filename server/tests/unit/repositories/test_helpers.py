"""Unit tests for repositories.helpers — soft-delete payloads and snapshot conversion."""

from datetime import datetime

from app.db import SERVER_TIMESTAMP
from app.repositories.helpers import (
    dict_to_snapshot,
    is_deleted,
    restore_payload,
    soft_delete_payload,
    to_snapshot_list,
)
from tests.support.fakes import FakeFirestoreDoc


class TestSoftDeletePayload:
    def test_marks_deleted_with_iso_timestamp(self):
        payload = soft_delete_payload()
        assert payload["deleted"] is True
        assert isinstance(payload["deleted_at"], str)
        datetime.fromisoformat(payload["deleted_at"])  # raises if not ISO

    def test_uses_server_timestamp_for_updated_at(self):
        assert soft_delete_payload()["updated_at"] is SERVER_TIMESTAMP


class TestRestorePayload:
    def test_clears_delete_markers(self):
        payload = restore_payload()
        assert payload["deleted"] is False
        assert payload["deleted_at"] is None
        assert payload["updated_at"] is SERVER_TIMESTAMP


class TestIsDeleted:
    def test_true_when_flag_set(self):
        assert is_deleted({"deleted": True}) is True

    def test_false_when_flag_absent(self):
        assert is_deleted({"name": "x"}) is False

    def test_false_when_data_none(self):
        assert is_deleted(None) is False

    def test_false_when_data_empty(self):
        assert is_deleted({}) is False


class TestRequireNotDeleted:
    def test_returns_dict_for_live_snapshot(self):
        snap = FakeFirestoreDoc("doc-1", {"name": "live", "deleted": False})
        result = __import__("app.repositories.helpers", fromlist=["require_not_deleted"]).require_not_deleted(snap)
        assert result == {"id": "doc-1", "name": "live", "deleted": False}

    def test_returns_none_for_missing_snapshot(self):
        from app.repositories.helpers import require_not_deleted

        snap = FakeFirestoreDoc("doc-1", {}, exists=False)
        assert require_not_deleted(snap) is None

    def test_returns_none_for_soft_deleted(self):
        from app.repositories.helpers import require_not_deleted

        snap = FakeFirestoreDoc("doc-1", {"deleted": True})
        assert require_not_deleted(snap) is None


class TestSnapshotConversion:
    def test_dict_to_snapshot_exposes_id_and_dict(self):
        snap = dict_to_snapshot({"id": "a", "value": 7})
        assert snap.id == "a"
        assert snap.to_dict() == {"id": "a", "value": 7}

    def test_to_snapshot_list_maps_all_items(self):
        snaps = to_snapshot_list([{"id": "a"}, {"id": "b"}])
        assert [s.id for s in snaps] == ["a", "b"]
