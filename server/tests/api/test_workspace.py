import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.db import get_firestore

mock_user = {"uid": "test-user-123", "email": "test@example.com"}
mock_db = MagicMock()

client = TestClient(app)


def _install_overrides():
    """Apply this module's dependency overrides (restored by _remove_overrides)."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_firestore] = lambda: mock_db


def _remove_overrides():
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_firestore, None)


class _OverridesMixin:
    """Install this module's dependency overrides for the duration of each test."""

    def setUp(self):
        self._prev_user = app.dependency_overrides.get(get_current_user)
        self._prev_db = app.dependency_overrides.get(get_firestore)
        _install_overrides()

    def tearDown(self):
        if self._prev_user is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = self._prev_user
        if self._prev_db is None:
            app.dependency_overrides.pop(get_firestore, None)
        else:
            app.dependency_overrides[get_firestore] = self._prev_db


class TestWorkspaceEndpoints(_OverridesMixin, unittest.TestCase):
    def test_health_check(self):
        response = client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_list_jobs_mocked(self):
        mock_collection = MagicMock()
        mock_query = MagicMock()
        mock_query.stream.return_value = []
        mock_collection.order_by.return_value = mock_query
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection

        response = client.get("/api/v1/jobs")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json()["items"], list)

    def test_create_job_mocked(self):
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "job-999"
        mock_doc_ref.get.return_value.to_dict.return_value = {
            "company": "Acme Corp",
            "role": "Frontend Engineer",
            "status": "Applied",
            "location": "Remote",
            "work_type": "Full-time",
            "salary": "$120k",
            "resume_id": "",
            "job_url": "",
            "notes": "",
        }

        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection

        payload = {
            "company": "Acme Corp",
            "role": "Frontend Engineer",
            "status": "Applied",
            "location": "Remote",
            "work_type": "Full-time",
            "salary": "$120k",
        }
        response = client.post("/api/v1/jobs", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["id"], "job-999")
        self.assertEqual(data["company"], "Acme Corp")

    def test_delete_job_mocked(self):
        mock_doc_ref = MagicMock()
        mock_doc_ref.get.return_value.exists = True
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection

        response = client.delete("/api/v1/jobs/job-999")
        self.assertEqual(response.status_code, 204)

    def test_create_project_mocked_with_lifecycle_phase(self):
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "project-42"
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection

        payload = {
            "name": "StarWaves Web",
            "status": "Planning",
            "progress": 10,
            "members": 2,
            "technologies": ["React", "FastAPI"],
            "lifecycle_phase": "design",
        }
        response = client.post("/api/v1/projects", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["id"], "project-42")
        self.assertEqual(data["lifecycle_phase"], "design")

    def test_patch_project_lifecycle_phase_mocked(self):
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "project-42"
        mock_doc_ref.get.return_value.exists = True
        mock_doc_ref.get.return_value.to_dict.return_value = {
            "name": "StarWaves Web",
            "status": "Active",
            "progress": 40,
            "members": 2,
            "technologies": [],
            "lifecycle_phase": "build",
        }
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection

        response = client.patch(
            "/api/v1/projects/project-42",
            json={"lifecycle_phase": "build", "status": "Active"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lifecycle_phase"], "build")

    def test_mark_all_notifications_read(self):
        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.return_value = []
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection

        response = client.post("/api/v1/notifications/mark-all-read")
        self.assertEqual(response.status_code, 200)
        self.assertIn("updated", response.json())


class FakeFirestoreDoc:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data
        self.exists = True

    def to_dict(self):
        return self._data


def stub_sessions_collection():
    mock_collection = MagicMock()
    mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
    return mock_collection


class TestEveSessionEndpoints(_OverridesMixin, unittest.TestCase):
    def test_create_eve_session_mocked(self):
        mock_collection = stub_sessions_collection()
        mock_collection.document.return_value.id = "sess-123"

        payload = {"messages": [{"role": "user", "content": "Plan my week"}]}
        response = client.post("/api/v1/eve/sessions", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()["session"]
        self.assertEqual(data["id"], "sess-123")
        self.assertEqual(data["title"], "Plan my week")

    def test_create_eve_session_empty_defaults_to_starter(self):
        mock_collection = stub_sessions_collection()
        mock_collection.document.return_value.id = "sess-456"

        response = client.post("/api/v1/eve/sessions", json={"messages": []})
        self.assertEqual(response.status_code, 201)
        data = response.json()["session"]
        self.assertEqual(data["title"], "New chat")
        self.assertEqual(data["messages"][0]["role"], "assistant")

    def test_list_eve_sessions_mocked(self):
        mock_collection = stub_sessions_collection()
        mock_collection.order_by.return_value.limit.return_value.stream.return_value = [
            FakeFirestoreDoc("sess-2", {"title": "Plan my week", "messages": [{"role": "user", "content": "Plan my week"}], "updated_at": "2026-08-08T10:00:00+00:00"}),
            FakeFirestoreDoc("sess-1", {"title": "New chat", "messages": [], "updated_at": "2026-08-07T10:00:00+00:00"}),
        ]

        response = client.get("/api/v1/eve/sessions")
        self.assertEqual(response.status_code, 200)
        sessions = response.json()["sessions"]
        self.assertEqual(len(sessions), 2)
        self.assertEqual(sessions[0]["id"], "sess-2")
        self.assertEqual(sessions[0]["preview"], "Plan my week")

    def test_get_eve_session_mocked(self):
        mock_collection = stub_sessions_collection()
        mock_collection.document.return_value.get.return_value.exists = True
        mock_collection.document.return_value.get.return_value.to_dict.return_value = {
            "title": "Plan my week",
            "created_at": "2026-08-08T10:00:00+00:00",
            "updated_at": "2026-08-08T10:00:00+00:00",
            "messages": [{"role": "user", "content": "Plan my week"}],
        }

        response = client.get("/api/v1/eve/sessions/sess-2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["session"]["id"], "sess-2")

    def test_get_eve_session_missing_returns_404(self):
        mock_collection = stub_sessions_collection()
        mock_collection.document.return_value.get.return_value.exists = False

        response = client.get("/api/v1/eve/sessions/missing")
        self.assertEqual(response.status_code, 404)

    def test_delete_eve_session_mocked(self):
        mock_collection = stub_sessions_collection()
        mock_collection.document.return_value.get.return_value.exists = True

        response = client.delete("/api/v1/eve/sessions/sess-2")
        self.assertEqual(response.status_code, 204)

    def test_delete_eve_session_missing_returns_404(self):
        mock_collection = stub_sessions_collection()
        mock_collection.document.return_value.get.return_value.exists = False

        response = client.delete("/api/v1/eve/sessions/missing")
        self.assertEqual(response.status_code, 404)


def stub_memories_collection():
    mock_collection = MagicMock()
    mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
    return mock_collection


class TestEveMemoryEndpoints(_OverridesMixin, unittest.TestCase):
    def test_list_eve_memories_mocked(self):
        mock_collection = stub_memories_collection()
        mock_collection.order_by.return_value.limit.return_value.stream.return_value = [
            FakeFirestoreDoc("mem-1", {"content": "Prefers morning standups", "created_at": "2026-08-08T10:00:00+00:00", "updated_at": "2026-08-08T10:00:00+00:00"}),
        ]

        response = client.get("/api/v1/eve/memories")
        self.assertEqual(response.status_code, 200)
        memories = response.json()["memories"]
        self.assertEqual(len(memories), 1)
        self.assertEqual(memories[0]["id"], "mem-1")
        self.assertEqual(memories[0]["content"], "Prefers morning standups")

    def test_create_eve_memory_mocked(self):
        mock_collection = stub_memories_collection()
        mock_collection.document.return_value.id = "mem-2"
        mock_collection.order_by.return_value.limit.return_value.stream.return_value = []

        response = client.post("/api/v1/eve/memories", json={"content": "Working on StarWaves"})
        self.assertEqual(response.status_code, 201)
        memories = response.json()["memories"]
        self.assertEqual(memories[0]["id"], "mem-2")
        self.assertEqual(memories[0]["content"], "Working on StarWaves")

    def test_delete_eve_memory_mocked(self):
        mock_collection = stub_memories_collection()
        mock_collection.document.return_value.get.return_value.exists = True

        response = client.delete("/api/v1/eve/memories/mem-2")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Memory removed.")

    def test_delete_eve_memory_missing_returns_404(self):
        mock_collection = stub_memories_collection()
        mock_collection.document.return_value.get.return_value.exists = False

        response = client.delete("/api/v1/eve/memories/missing")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
