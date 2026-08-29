import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.db import get_firestore
from app.schemas.whatsapp import WhatsAppStatusResponse

mock_user = {"uid": "test-user-123", "email": "test@example.com"}
mock_db = MagicMock()


class TestWhatsAppEndpoints(unittest.TestCase):
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

    @patch("app.services.whatsapp.WhatsAppService.get_status")
    def test_whatsapp_status(self, mock_status):
        mock_status.return_value = WhatsAppStatusResponse(
            connected=True,
            phone_number="+15551234567",
            push_name="Tester",
        )
        response = self.client.get("/api/v1/whatsapp/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["connected"])
        self.assertEqual(data["phone_number"], "+15551234567")

    def test_whatsapp_pair_endpoint(self):
        # QR pairing
        response = self.client.post("/api/v1/whatsapp/pair", json={})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn(data["status"], ["qr_ready", "waiting", "paired"])

        # Phone pairing
        phone_response = self.client.post("/api/v1/whatsapp/pair", json={"phone_number": "+15551234567"})
        self.assertEqual(phone_response.status_code, 200)
        phone_data = phone_response.json()
        self.assertIn(phone_data["status"], ["qr_ready", "waiting", "paired"])


if __name__ == "__main__":
    unittest.main()
