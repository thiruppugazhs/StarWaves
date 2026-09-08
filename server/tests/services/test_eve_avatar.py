"""Service + schema tests for Eve avatar preferences (zoom / autoRotate view controls)."""

import pytest
from pydantic import ValidationError


class TestEveAvatarPrefSchemas:
    def test_defaults_include_view_controls(self):
        from app.schemas.eve_avatar import EveAvatarPrefs

        prefs = EveAvatarPrefs()
        assert prefs.zoom == 1.0
        assert prefs.autoRotate is False

    def test_request_accepts_valid_view_controls(self):
        from app.schemas.eve_avatar import EveAvatarPrefsRequest

        req = EveAvatarPrefsRequest(zoom=0.3, autoRotate=True, userPan={"x": 12, "y": -8})
        assert req.zoom == 0.3
        assert req.autoRotate is True

    def test_request_rejects_zoom_out_of_range(self):
        from app.schemas.eve_avatar import EveAvatarPrefsRequest

        with pytest.raises(ValidationError):
            EveAvatarPrefsRequest(zoom=0.1)
        with pytest.raises(ValidationError):
            EveAvatarPrefsRequest(zoom=3.1)


class TestEveAvatarSavePrefs:
    def test_defaults_include_view_controls(self, db):
        from app.services import eve_avatar
        from tests.support.db import get_sql_client

        prefs = eve_avatar.get_prefs(get_sql_client(), "user-1")
        assert prefs["zoom"] == 1.0
        assert prefs["autoRotate"] is False

    def test_save_valid_view_controls(self, db):
        from app.services import eve_avatar
        from tests.support.db import get_sql_client

        prefs = eve_avatar.save_prefs(get_sql_client(), "user-1", {"zoom": 0.3, "userPan": {"x": 12, "y": -8}, "autoRotate": True})
        assert prefs["zoom"] == 0.3
        assert prefs["userPan"] == {"x": 12.0, "y": -8.0}
        assert prefs["autoRotate"] is True
        # round-trip through a fresh read
        again = eve_avatar.get_prefs(get_sql_client(), "user-1")
        assert again["zoom"] == 0.3
        assert again["autoRotate"] is True

    def test_reject_zoom_out_of_range(self, db):
        from app.services import eve_avatar
        from tests.support.db import get_sql_client

        with pytest.raises(ValueError, match="zoom"):
            eve_avatar.save_prefs(get_sql_client(), "user-1", {"zoom": 0.1})
        with pytest.raises(ValueError, match="zoom"):
            eve_avatar.save_prefs(get_sql_client(), "user-1", {"zoom": 3.1})

    def test_unknown_keys_are_ignored(self, db):
        from app.services import eve_avatar
        from tests.support.db import get_sql_client

        prefs = eve_avatar.save_prefs(get_sql_client(), "user-1", {"zoom": 1.25, "nope": "junk"})
        assert prefs["zoom"] == 1.25
        assert "nope" not in prefs
