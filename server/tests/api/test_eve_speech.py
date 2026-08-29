import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.db import get_firestore

mock_user = {"uid": "test-user-123", "email": "test@example.com"}
mock_db = MagicMock()

client = TestClient(app)


class TestEveSpeechSettings(unittest.TestCase):
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

    def test_get_eve_speech_empty_preference(self):
        self._mock_settings_snapshot()

        response = client.get("/api/v1/settings/eve-speech")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data["stt_providers"], list)
        self.assertIsInstance(data["tts_providers"], list)
        self.assertGreaterEqual(len(data["stt_providers"]), 1)
        self.assertGreaterEqual(len(data["tts_providers"]), 1)
        self.assertIn("available", data["stt_providers"][0])
        self.assertIn("available", data["tts_providers"][0])
        self.assertIsNone(data["preference"])

    def test_get_eve_speech_returns_saved_preference(self):
        self._mock_settings_snapshot(
            {
                "stt_provider": "groq",
                "stt_model": "whisper-large-v3",
                "tts_provider": "google",
                "tts_voice": "en-US-Standard-C",
            }
        )

        response = client.get("/api/v1/settings/eve-speech")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(
            data["preference"],
            {
                "stt_provider": "groq",
                "stt_model": "whisper-large-v3",
                "tts_provider": "google",
                "tts_voice": "en-US-Standard-C",
            },
        )

    def test_put_eve_speech_saves_preference(self):
        document = self._mock_settings_snapshot()

        payload = {
            "stt_provider": "browser",
            "stt_model": "",
            "tts_provider": "browser",
            "tts_voice": "",
        }
        response = client.put("/api/v1/settings/eve-speech", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["preference"], payload)
        document.set.assert_called_once()

    def test_put_eve_speech_saves_groq_preference(self):
        self._mock_settings_snapshot()

        payload = {
            "stt_provider": "groq",
            "stt_model": "whisper-large-v3",
            "tts_provider": "google",
            "tts_voice": "en-US-Standard-A",
        }
        response = client.put("/api/v1/settings/eve-speech", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["preference"], payload)

    def test_stt_catalog_includes_deepgram(self):
        self._mock_settings_snapshot()

        response = client.get("/api/v1/settings/eve-speech")
        self.assertEqual(response.status_code, 200)
        provider_ids = {provider["id"] for provider in response.json()["stt_providers"]}
        self.assertIn("deepgram", provider_ids)
        deepgram_entry = next(
            provider
            for provider in response.json()["stt_providers"]
            if provider["id"] == "deepgram"
        )
        model_ids = {model["id"] for model in deepgram_entry["models"]}
        self.assertIn("nova-3", model_ids)

    def test_put_eve_speech_saves_deepgram_preference(self):
        document = self._mock_settings_snapshot()

        payload = {
            "stt_provider": "deepgram",
            "stt_model": "nova-3",
            "tts_provider": "browser",
            "tts_voice": "",
        }
        response = client.put("/api/v1/settings/eve-speech", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["preference"], payload)
        document.set.assert_called_once()

    def test_put_eve_speech_rejects_unknown_deepgram_model(self):
        self._mock_settings_snapshot()

        payload = {
            "stt_provider": "deepgram",
            "stt_model": "does-not-exist",
            "tts_provider": "browser",
            "tts_voice": "",
        }
        response = client.put("/api/v1/settings/eve-speech", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_put_eve_speech_rejects_unknown_provider(self):
        self._mock_settings_snapshot()

        payload = {
            "stt_provider": "unknown-provider",
            "stt_model": "",
            "tts_provider": "browser",
            "tts_voice": "",
        }
        response = client.put("/api/v1/settings/eve-speech", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_put_eve_speech_rejects_unknown_model(self):
        self._mock_settings_snapshot()

        payload = {
            "stt_provider": "groq",
            "stt_model": "does-not-exist",
            "tts_provider": "browser",
            "tts_voice": "",
        }
        response = client.put("/api/v1/settings/eve-speech", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_put_eve_speech_rejects_unknown_voice(self):
        self._mock_settings_snapshot()

        payload = {
            "stt_provider": "browser",
            "stt_model": "",
            "tts_provider": "google",
            "tts_voice": "does-not-exist",
        }
        response = client.put("/api/v1/settings/eve-speech", json=payload)
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
