import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.db import get_firestore

mock_user = {"uid": "test-user-123", "email": "test@example.com"}
mock_db = MagicMock()

client = TestClient(app)


class TestAiModelsSettings(unittest.TestCase):
    def setUp(self):
        # Isolate this module's dependency overrides so the shared global
        # app.dependency_overrides (also mutated by other test modules) cannot
        # leak into these tests.
        self._saved_current_user = app.dependency_overrides.get(get_current_user)
        self._saved_firestore = app.dependency_overrides.get(get_firestore)
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_firestore] = lambda: mock_db

    def tearDown(self):
        self._restore_override(get_current_user, self._saved_current_user)
        self._restore_override(get_firestore, self._saved_firestore)

    @staticmethod
    def _restore_override(dependency, previous):
        if previous is None:
            app.dependency_overrides.pop(dependency, None)
        else:
            app.dependency_overrides[dependency] = previous

    def _mock_settings_snapshot(self, data=None):
        snapshot = MagicMock()
        if data is None:
            snapshot.exists = False
        else:
            snapshot.exists = True
            snapshot.to_dict.return_value = data
        document = MagicMock()
        document.get.return_value = snapshot
        (
            mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value
        ) = document
        return document

    def test_get_ai_models_empty_preference(self):
        self._mock_settings_snapshot()

        response = client.get("/api/v1/settings/ai-models")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data["providers"], list)
        self.assertGreaterEqual(len(data["providers"]), 1)
        self.assertIn("available", data["providers"][0])
        self.assertIsNone(data["preference"])

    def test_get_ai_models_returns_saved_preference(self):
        self._mock_settings_snapshot({
            "provider": "anthropic",
            "model": "claude-sonnet-4-5",
            "api_keys": {"anthropic": "sk-ant-test"},
        })

        response = client.get("/api/v1/settings/ai-models")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["preference"]["provider"], "anthropic")
        self.assertEqual(data["preference"]["model"], "claude-sonnet-4-5")
        self.assertTrue(data["preference"]["has_api_key"])
        self.assertIn("default_provider", data)

    def test_put_ai_models_saves_default_preference(self):
        document = self._mock_settings_snapshot()

        payload = {"provider": "default", "model": "default"}
        response = client.put("/api/v1/settings/ai-models", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["preference"]["provider"], "default")
        self.assertEqual(data["preference"]["model"], "default")
        document.set.assert_called_once()

    def test_put_ai_models_saves_openai_preference(self):
        document = self._mock_settings_snapshot()

        payload = {"provider": "openai", "model": "gpt-5-mini", "api_key": "sk-openai-key-test"}
        response = client.put("/api/v1/settings/ai-models", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["preference"]["provider"], "openai")
        self.assertEqual(data["preference"]["model"], "gpt-5-mini")
        document.set.assert_called_once()

    def test_put_ai_models_saves_custom_provider_with_api_key(self):
        document = self._mock_settings_snapshot()

        payload = {
            "provider": "anthropic",
            "model": "claude-sonnet-4-5",
            "api_key": "sk-ant-test-key-12345",
        }
        response = client.put("/api/v1/settings/ai-models", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["preference"]["provider"], "anthropic")
        self.assertEqual(data["preference"]["model"], "claude-sonnet-4-5")
        self.assertTrue(data["preference"]["has_api_key"])
        document.set.assert_called_once()

    def test_put_ai_models_rejects_unknown_provider(self):
        self._mock_settings_snapshot()

        payload = {"provider": "unknown-provider", "model": "gpt-5-mini"}
        response = client.put("/api/v1/settings/ai-models", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_put_ai_models_rejects_unknown_model(self):
        # Live provider now allows any non-empty model id for known provider (dynamic catalog) — unknown model accepted with valid key
        document = self._mock_settings_snapshot()
        payload = {"provider": "openai", "model": "does-not-exist", "api_key": "sk-openai-key-test"}
        response = client.put("/api/v1/settings/ai-models", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["preference"]["model"], "does-not-exist")

    def test_eve_chat_returns_detailed_502_error_on_ai_failure(self):
        self._mock_settings_snapshot()
        from unittest.mock import patch
        from app.services.ai_models import AIServiceError

        with patch("app.services.eve.chat.run_tool_loop", side_effect=AIServiceError("API key expired or quota reached")):
            with patch("app.services.eve.chat.any_provider_available", return_value=True):
                payload = {"messages": [{"role": "user", "content": "Hello Eve"}]}
                response = client.post("/api/v1/eve/chat", json=payload)
                self.assertEqual(response.status_code, 502)
                data = response.json()
                self.assertIn("Eve AI service error", data["detail"])
                self.assertIn("API key expired or quota reached", data["detail"])


if __name__ == "__main__":
    unittest.main()
