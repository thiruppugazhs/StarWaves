import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.core.auth import create_user_token
from app.core.ws_manager import CallWSManager
from app.main import app


class TestCallWSManager(unittest.IsolatedAsyncioTestCase):
    async def test_connect_and_disconnect(self):
        manager = CallWSManager()
        mock_ws = AsyncMock()

        await manager.connect("user-1", mock_ws)
        mock_ws.accept.assert_awaited_once()
        self.assertIn("user-1", manager._connections)

        manager.disconnect("user-1")
        self.assertNotIn("user-1", manager._connections)

    async def test_send_to_connected_user(self):
        manager = CallWSManager()
        mock_ws = AsyncMock()

        await manager.connect("user-1", mock_ws)
        await manager.send("user-1", {"type": "incoming_call", "call": {"id": "c1"}})
        mock_ws.send_json.assert_awaited_once_with({"type": "incoming_call", "call": {"id": "c1"}})

    async def test_send_to_offline_user_is_noop(self):
        manager = CallWSManager()
        # Should not raise exception
        await manager.send("offline-user", {"type": "ping"})


class TestCallWebSocketEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.user = {"uid": "ws-test-uid", "email": "wstest@example.com", "name": "WS Test"}
        self.token = create_user_token(self.user)

    def test_ws_rejects_invalid_token(self):
        with self.assertRaises(Exception):
            with self.client.websocket_connect("/ws/calls?token=invalid-token"):
                pass

    @patch("app.api.routes.calls_ws.CallRepository")
    @patch("app.api.routes.calls_ws.get_firestore")
    def test_ws_accepts_valid_token(self, mock_firestore, mock_repo_class):
        mock_repo = mock_repo_class.return_value
        mock_repo.list_incoming.return_value = []
        with self.client.websocket_connect(f"/ws/calls?token={self.token}") as ws:
            # Successfully connected
            self.assertIsNotNone(ws)
