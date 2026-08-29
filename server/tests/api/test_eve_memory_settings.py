import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.db import get_firestore

mock_user = {"uid": "test-user-123", "email": "test@example.com"}
mock_db = MagicMock()

client = TestClient(app)


class TestEveMemorySettings(unittest.TestCase):
    def setUp(self):
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

    def test_get_defaults_to_auto_remember_on(self):
        self._mock_settings_snapshot()

        response = client.get("/api/v1/settings/eve-memory")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"auto_remember": True})

    def test_get_returns_saved_off_state(self):
        self._mock_settings_snapshot({"auto_remember": False})

        response = client.get("/api/v1/settings/eve-memory")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"auto_remember": False})

    def test_put_saves_toggle(self):
        document = self._mock_settings_snapshot({"auto_remember": True})

        response = client.put("/api/v1/settings/eve-memory", json={"auto_remember": False})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"auto_remember": False})
        document.set.assert_called_once()
        saved_kwargs = document.set.call_args
        self.assertFalse(saved_kwargs.args[0]["auto_remember"])
        self.assertTrue(saved_kwargs.kwargs.get("merge"))

    def test_put_rejects_missing_field(self):
        self._mock_settings_snapshot()

        response = client.put("/api/v1/settings/eve-memory", json={})
        self.assertEqual(response.status_code, 422)


class TestAutoRememberExtraction(unittest.TestCase):
    def _service(self):
        from app.services.eve.auto_memory import extract_and_save_memories

        return extract_and_save_memories

    def test_skips_when_disabled(self):
        database = MagicMock()
        messages = [{"role": "user", "content": "I use Neovim daily"}]
        with patch(
            "app.services.eve.auto_memory.resolve_auto_remember",
            return_value=False,
        ) as toggle:
            saved = self._service()(database, mock_user, messages, "Noted!")
            self.assertEqual(saved, [])
            toggle.assert_called_once()
        database.collection.assert_not_called()

    def test_saves_new_facts_and_dedupes(self):
        database = MagicMock()
        messages = [
            {"role": "user", "content": "I use Neovim daily and I'm building Starwaves"},
        ]
        fake_response = MagicMock(
            text='["Prefers Neovim as daily editor", "Is building the Starwaves project"]'
        )
        fake_client = MagicMock()
        fake_client.call.return_value = fake_response
        with (
            patch(
                "app.services.eve.auto_memory.resolve_auto_remember",
                return_value=True,
            ),
            patch(
                "app.services.eve.auto_memory.resolve_ai_config"
            ) as resolve_config,
            patch(
                "app.services.eve.auto_memory.PROVIDER_CLIENTS"
            ) as providers,
            patch(
                "app.services.eve.auto_memory.list_memories",
                return_value=[{"content": "prefers neovim as daily editor"}],
            ) as list_memories,
            patch(
                "app.services.eve.auto_memory.add_memory",
                return_value={"id": "m1"},
            ) as add_memory,
        ):
            config = MagicMock()
            config.provider = "openai"
            config.model = "gpt-5-mini"
            config.client_options = {}
            resolve_config.return_value = config
            providers.__getitem__.return_value = MagicMock(return_value=fake_client)

            saved = self._service()(database, mock_user, messages, "Great!")

            # First fact dedupes against existing memory; only the new one saves
            add_memory.assert_called_once_with(database, mock_user["uid"], "Is building the Starwaves project")
            self.assertEqual(saved, ["Is building the Starwaves project"])
            list_memories.assert_called_once()

    def test_parse_facts_handles_fenced_json(self):
        from app.services.eve.auto_memory import _parse_facts

        raw = '```json\n["Likes dark mode", "Ships on Fridays"]\n```'
        self.assertEqual(_parse_facts(raw), ["Likes dark mode", "Ships on Fridays"])

    def test_parse_facts_caps_at_three(self):
        from app.services.eve.auto_memory import _parse_facts

        raw = '["a", "b", "c", "d", "e"]'
        self.assertEqual(len(_parse_facts(raw)), 3)


if __name__ == "__main__":
    unittest.main()
