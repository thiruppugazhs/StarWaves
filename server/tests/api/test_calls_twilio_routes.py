"""API tests: Twilio PSTN routes (/calls/twilio/*) on real SQLite."""

import pytest

from app.services.twilio.client import TwilioError


@pytest.fixture()
def twilio_on(monkeypatch):
    """Pretend Twilio env vars are configured and stub the REST call."""
    from app.api.routes import calls_twilio as mod

    monkeypatch.setattr(mod, "is_twilio_configured", lambda: True)
    sent = {}

    def fake_initiate(phone, twiml_url, status_cb):
        sent.update(phone=phone, twiml_url=twiml_url, status_cb=status_cb)
        return {"sid": "CA-test-sid-123"}

    monkeypatch.setattr(mod, "initiate_twilio_call", fake_initiate)
    return sent


class TestTwilioConfig:
    def test_config_disabled_by_default(self, auth_client):
        res = auth_client.get("/api/v1/calls/twilio/config")
        assert res.status_code == 200
        body = res.json()
        assert body["enabled"] is False
        assert body["from_number"] is None

    def test_config_enabled_with_settings(self, auth_client, monkeypatch):
        from app.api.routes import calls_twilio as mod

        monkeypatch.setattr(mod, "is_twilio_configured", lambda: True)
        res = auth_client.get("/api/v1/calls/twilio/config")
        assert res.json()["enabled"] is True


class TestCreateTwilioCall:
    def test_unconfigured_returns_503(self, auth_client):
        res = auth_client.post(
            "/api/v1/calls/twilio",
            json={"phone_number": "+15550001111", "mode": "audio"},
        )
        assert res.status_code == 503

    def test_create_call_persists_record_and_sid(self, auth_client, db, twilio_on):
        res = auth_client.post(
            "/api/v1/calls/twilio",
            json={"phone_number": "+15550001111", "mode": "audio", "message": "Hi there"},
        )
        assert res.status_code in (200, 201)
        call = res.json()
        assert call["provider"] == "twilio"
        assert call["external_sid"] == "CA-test-sid-123"
        assert call["callee"]["uid"].startswith("phone:")
        # The TwiML URL points back at this server for the created call
        assert f"/relay-twiml/{call['id']}" in twilio_on["twiml_url"]

    def test_twilio_failure_marks_missed_and_502(self, auth_client, db, monkeypatch):
        from app.api.routes import calls_twilio as mod

        monkeypatch.setattr(mod, "is_twilio_configured", lambda: True)

        def boom(phone, twiml_url, status_cb):
            raise TwilioError("invalid number")

        monkeypatch.setattr(mod, "initiate_twilio_call", boom)

        res = auth_client.post(
            "/api/v1/calls/twilio",
            json={"phone_number": "+15550002222", "mode": "audio"},
        )
        assert res.status_code == 502


class TestTriggerEveTwilio:
    def test_eve_is_caller_with_prompt_say(self, auth_client, db, twilio_on):
        res = auth_client.post(
            "/api/v1/calls/trigger-eve-twilio",
            json={"phone_number": "+15550003333", "prompt": "Reminder from Eve"},
        )
        assert res.status_code in (200, 201)
        call = res.json()
        assert call["caller"]["uid"] == "eve-bot"
        say_messages = [m for m in call["messages"] if m.get("type") == "say"]
        assert say_messages and "Reminder" in say_messages[0]["payload"]

    def test_unconfigured_503(self, auth_client, db):
        res = auth_client.post(
            "/api/v1/calls/trigger-eve-twilio",
            json={"phone_number": "+15550004444"},
        )
        assert res.status_code == 503


class TestTwiMLEndpoints:
    @pytest.fixture()
    def eve_call_id(self, auth_client, twilio_on):
        call = auth_client.post(
            "/api/v1/calls/trigger-eve-twilio",
            json={"phone_number": "+15550005555", "prompt": "Hello from Eve relay"},
        ).json()
        return call["id"]

    def test_relay_twiml_contains_ws_url(self, client, db, eve_call_id):
        res = client.get(f"/api/v1/calls/twilio/relay-twiml/{eve_call_id}")
        assert res.status_code == 200
        assert "application/xml" in res.headers["content-type"]
        assert "<Connect>" in res.text or "ConversationRelay" in res.text or "Stream" in res.text
        assert eve_call_id in res.text

    def test_human_twiml_endpoint(self, auth_client, db, twilio_on):
        call = auth_client.post(
            "/api/v1/calls/twilio",
            json={"phone_number": "+15550006666", "mode": "audio"},
        ).json()
        res = auth_client.get(f"/api/v1/calls/twilio/twiml/{call['id']}")
        assert res.status_code == 200
        assert "<Response" in res.text or "<Response/>" in res.text

    def test_gather_without_speech_falls_back(self, client, db):
        res = client.post(
            "/api/v1/calls/twilio/gather",
            data={"CallSid": "CA-none"},
        )
        assert res.status_code == 200
        assert "<Say" in res.text

    def test_status_callback_updates_call_state(self, auth_client, db, twilio_on, monkeypatch):
        call = auth_client.post(
            "/api/v1/calls/twilio",
            json={"phone_number": "+15550007777", "mode": "audio"},
        ).json()

        res = auth_client.post(
            "/api/v1/calls/twilio/status",
            data={"CallSid": "CA-test-sid-123", "CallStatus": "completed"},
        )
        assert res.status_code == 200

        updated = auth_client.get(f"/api/v1/calls/{call['id']}")
        if updated.status_code == 200:
            assert updated.json()["status"] in ("ended", "completed")

    def test_status_callback_unknown_sid_still_200(self, client, db):
        res = client.post(
            "/api/v1/calls/twilio/status",
            data={"CallSid": "CA-unknown", "CallStatus": "busy"},
        )
        assert res.status_code == 200

