import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app


class TestCronEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("app.api.routes.cron.get_firestore")
    @patch("app.api.routes.cron.list_all_due_schedules", return_value=[])
    def test_process_jobs_unified_endpoint(self, mock_schedules, mock_db):
        mock_db_instance = MagicMock()
        mock_db.return_value = mock_db_instance

        # Test GET /api/v1/cron/process-jobs
        from app.core.config import settings
        secret_val = settings.cron_secret or "starwaves-cron-secret"
        response = self.client.get(
            f"/api/v1/cron/process-jobs?secret={secret_val}"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("jobs", data)
        self.assertIn("eve_schedules", data["jobs"])
        self.assertIn("stale_calls", data["jobs"])
        self.assertIn("daily_maintenance", data["jobs"])

    @patch("app.api.routes.cron.get_firestore")
    @patch("app.api.routes.cron.list_all_due_schedules", return_value=[])
    def test_cron_authorization_failure(self, mock_schedules, mock_db):
        mock_db.return_value = MagicMock()
        response = self.client.get(
            "/api/v1/cron/process-jobs",
            headers={"Authorization": "Bearer invalid-wrong-secret"}
        )
        self.assertEqual(response.status_code, 401)
