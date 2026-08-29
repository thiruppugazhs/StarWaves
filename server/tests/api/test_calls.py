import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.db import get_firestore

mock_user = {"uid": "test-user-123", "email": "test@example.com"}
mock_db = MagicMock()


class FakeFirestoreDoc:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data
        self.exists = True

    def to_dict(self):
        return self._data


def stub_caller_record():
    collection = mock_db.collection.return_value
    collection.where.return_value.limit.return_value.stream.return_value = []
    collection.document.return_value.get.return_value.exists = True
    collection.document.return_value.get.return_value.id = "callee-456"
    collection.document.return_value.get.return_value.to_dict.return_value = {
        "uid": "callee-456",
        "email": "callee@example.com",
        "display_name": "Callee User",
    }


def stub_call_participant():
    collection = mock_db.collection.return_value
    collection.document.return_value.get.return_value.exists = True
    collection.document.return_value.get.return_value.id = "call-1"
    collection.document.return_value.get.return_value.to_dict.return_value = {
        "caller": {"uid": "test-user-123", "name": "Me", "email": "test@example.com"},
        "callee": {"uid": "callee-456", "name": "Callee User", "email": "callee@example.com"},
        "participants": ["test-user-123", "callee-456"],
        "mode": "video",
        "status": "active",
        "messages": [],
    }


class TestCallEndpoints(unittest.TestCase):
    def setUp(self):
        self._prev_user = app.dependency_overrides.get(get_current_user)
        self._prev_db = app.dependency_overrides.get(get_firestore)
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_firestore] = lambda: mock_db
        self.client = TestClient(app)

    def tearDown(self):
        if self._prev_user is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = self._prev_user
        if self._prev_db is None:
            app.dependency_overrides.pop(get_firestore, None)
        else:
            app.dependency_overrides[get_firestore] = self._prev_db

    def test_create_call_mocked(self):
        stub_caller_record()

        response = self.client.post(
            "/api/v1/calls",
            json={"callee_identifier": "callee@example.com", "mode": "audio"},
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn("id", data)
        self.assertEqual(data["status"], "ringing")
        self.assertEqual(data["mode"], "audio")
        self.assertEqual(data["callee"]["uid"], "callee-456")
        self.assertEqual(data["caller"]["uid"], "test-user-123")

    def test_create_call_to_self_returns_400(self):
        collection = mock_db.collection.return_value
        collection.where.return_value.limit.return_value.stream.return_value = []
        collection.document.return_value.get.return_value.exists = True
        collection.document.return_value.get.return_value.id = "test-user-123"
        collection.document.return_value.get.return_value.to_dict.return_value = {
            "uid": "test-user-123",
            "email": "test@example.com",
            "display_name": "Self",
        }

        response = self.client.post(
            "/api/v1/calls",
            json={"callee_identifier": "test@example.com", "mode": "video"},
        )
        self.assertEqual(response.status_code, 400)

    def test_create_call_unknown_user_returns_404(self):
        collection = mock_db.collection.return_value
        collection.where.return_value.limit.return_value.stream.return_value = []
        collection.document.return_value.get.return_value.exists = False

        response = self.client.post(
            "/api/v1/calls",
            json={"callee_identifier": "ghost@example.com", "mode": "video"},
        )
        self.assertEqual(response.status_code, 404)

    def test_get_call_mocked(self):
        stub_call_participant()

        response = self.client.get("/api/v1/calls/call-1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], "call-1")
        self.assertEqual(response.json()["status"], "active")

    def test_get_call_non_participant_returns_403(self):
        collection = mock_db.collection.return_value
        collection.document.return_value.get.return_value.exists = True
        collection.document.return_value.get.return_value.id = "call-1"
        collection.document.return_value.get.return_value.to_dict.return_value = {
            "caller": {"uid": "other-a", "name": "A", "email": "a@example.com"},
            "callee": {"uid": "other-b", "name": "B", "email": "b@example.com"},
            "participants": ["other-a", "other-b"],
            "mode": "video",
            "status": "ringing",
            "messages": [],
        }

        response = self.client.get("/api/v1/calls/call-1")
        self.assertEqual(response.status_code, 403)

    def test_update_call_status_mocked(self):
        stub_call_participant()

        response = self.client.patch(
            "/api/v1/calls/call-1/status",
            json={"status": "active"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "active")

    def test_send_call_signal_mocked(self):
        collection = mock_db.collection.return_value
        collection.document.return_value.get.return_value.exists = True
        collection.document.return_value.get.return_value.id = "call-1"
        collection.document.return_value.get.return_value.to_dict.return_value = {
            "caller": {"uid": "test-user-123", "name": "Me", "email": "test@example.com"},
            "callee": {"uid": "callee-456", "name": "Callee User", "email": "callee@example.com"},
            "participants": ["test-user-123", "callee-456"],
            "mode": "video",
            "status": "ringing",
            "messages": [
                {
                    "id": "sig-1",
                    "from_uid": "test-user-123",
                    "type": "offer",
                    "payload": "fake-sdp",
                    "created_at": "2026-08-12T10:00:00+00:00",
                }
            ],
        }

        response = self.client.post(
            "/api/v1/calls/call-1/signals",
            json={"type": "answer", "payload": "fake-answer"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["messages"][0]["type"], "offer")

    def test_list_recent_calls_mocked(self):
        collection = mock_db.collection.return_value
        collection.where.return_value.limit.return_value.stream.return_value = [
            FakeFirestoreDoc(
                "call-2",
                {
                    "caller": {"uid": "other", "name": "Other", "email": "other@example.com"},
                    "callee": {"uid": "test-user-123", "name": "Me", "email": "test@example.com"},
                    "participants": ["test-user-123", "other"],
                    "mode": "video",
                    "status": "ended",
                    "messages": [],
                    "updated_at": "2026-08-12T10:00:00+00:00",
                },
            ),
        ]

        response = self.client.get("/api/v1/calls/recent")
        self.assertEqual(response.status_code, 200)
        items = response.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], "call-2")

    def test_list_incoming_calls_mocked(self):
        collection = mock_db.collection.return_value
        collection.where.return_value.limit.return_value.stream.return_value = [
            FakeFirestoreDoc(
                "call-3",
                {
                    "caller": {"uid": "other", "name": "Other", "email": "other@example.com"},
                    "callee": {"uid": "test-user-123", "name": "Me", "email": "test@example.com"},
                    "participants": ["test-user-123", "other"],
                    "mode": "audio",
                    "status": "ringing",
                    "messages": [],
                    "updated_at": "2026-08-12T10:00:00+00:00",
                },
            ),
        ]

        response = self.client.get("/api/v1/calls/incoming")
        self.assertEqual(response.status_code, 200)
        items = response.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], "call-3")
        self.assertEqual(items[0]["status"], "ringing")

    def test_list_incoming_marks_stale_ringing_as_missed(self):
        # Stale ringing expiry is now handled by background worker / cron to keep
        # per-request latency low (previously done synchronously on every GET).
        from datetime import datetime, timedelta, timezone

        stale_updated_at = (
            datetime.now(timezone.utc) - timedelta(minutes=5)
        ).isoformat()
        collection = mock_db.collection.return_value
        collection.where.return_value.limit.return_value.stream.return_value = [
            FakeFirestoreDoc(
                "call-stale",
                {
                    "caller": {"uid": "other", "name": "Other", "email": "other@example.com"},
                    "callee": {"uid": "test-user-123", "name": "Me", "email": "test@example.com"},
                    "participants": ["test-user-123", "other"],
                    "mode": "audio",
                    "status": "ringing",
                    "messages": [],
                    "updated_at": stale_updated_at,
                },
            ),
        ]

        collection.document.return_value.update.reset_mock()
        response = self.client.get("/api/v1/calls/incoming")
        self.assertEqual(response.status_code, 200)
        # No synchronous expiry on request — background worker (ServerBackgroundWorker)
        # or cron now handles stale call cleanup.
        update_calls = [
            c for c in collection.document.return_value.update.call_args_list
            if c.args[0].get("status") == "missed"
        ]
        self.assertEqual(len(update_calls), 0)

    def test_prune_messages_keeps_bounded_array(self):
        from app.repositories.calls import MAX_SIGNAL_MESSAGES, CallRepository

        repository = CallRepository(mock_db)
        collection = mock_db.collection.return_value
        existing = [{"id": f"m{i}", "type": "ice-candidate"} for i in range(MAX_SIGNAL_MESSAGES + 50)]
        document = collection.document.return_value
        document.get.return_value.exists = True
        document.get.return_value.to_dict.return_value = {"messages": existing}

        repository.prune_messages("call-big")

        self.assertTrue(document.update.called)
        pruned = document.update.call_args.args[0]["messages"]
        self.assertEqual(len(pruned), MAX_SIGNAL_MESSAGES)
        self.assertEqual(pruned[0]["id"], "m50")
        self.assertEqual(pruned[-1]["id"], f"m{MAX_SIGNAL_MESSAGES + 49}")

    def test_expire_stale_ringing_skips_recent_and_non_ringing(self):
        from datetime import datetime, timedelta, timezone
        from app.repositories.calls import CallRepository

        repository = CallRepository(mock_db)
        collection = mock_db.collection.return_value
        recent_updated = datetime.now(timezone.utc).isoformat()
        collection.where.return_value.limit.return_value.stream.return_value = [
            FakeFirestoreDoc(
                "call-recent",
                {"status": "ringing", "updated_at": recent_updated, "id": "call-recent"},
            ),
            FakeFirestoreDoc(
                "call-ended",
                {"status": "ended", "updated_at": "2026-08-12T10:00:00+00:00", "id": "call-ended"},
            ),
        ]

        # Reset any prior update records so we only count guard updates here.
        collection.document.return_value.update.reset_mock()
        repository.expire_stale_ringing("test-user-123")

        # The ended call is skipped entirely and the recent ringing call is not
        # stale, so the guard must not issue any "missed" update.
        missed_updates = [
            c for c in collection.document.return_value.update.call_args_list
            if c.args[0].get("status") == "missed"
        ]
        self.assertEqual(len(missed_updates), 0)

    def test_create_call_dispatches_notification(self):
        stub_caller_record()
        from unittest.mock import patch
        with patch("app.api.routes.calls.send_call_notification") as mock_send_notif:
            response = self.client.post(
                "/api/v1/calls",
                json={"callee_identifier": "callee@example.com", "mode": "video"},
            )
            self.assertEqual(response.status_code, 201)
            mock_send_notif.assert_called_once()
            _, kwargs = mock_send_notif.call_args
            self.assertEqual(kwargs.get("target_user_id"), "callee-456")
            self.assertEqual(kwargs.get("notification_type"), "call_incoming")
            self.assertEqual(kwargs.get("title"), "Incoming Call")

    def test_update_call_status_declined_dispatches_notification(self):
        stub_call_participant()
        from unittest.mock import patch
        with patch("app.api.routes.calls.send_call_notification") as mock_send_notif:
            response = self.client.patch(
                "/api/v1/calls/call-1/status",
                json={"status": "declined"},
            )
            self.assertEqual(response.status_code, 200)
            mock_send_notif.assert_called_once()
            _, kwargs = mock_send_notif.call_args
            self.assertEqual(kwargs.get("target_user_id"), "test-user-123")
            self.assertEqual(kwargs.get("notification_type"), "call_declined")
            self.assertEqual(kwargs.get("title"), "Call Declined")


if __name__ == "__main__":
    unittest.main()