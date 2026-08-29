"""API tests: WhatsApp webhook + cron secrets + unified model discovery."""

import pytest


def _token() -> str:
    from app.core.auth import create_user_token

    return create_user_token({"uid": "user-1", "email": "user1@example.com", "name": "U1"})


def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {_token()}"}


class TestWhatsAppWebhook:
    @pytest.fixture(autouse=True)
    def _no_ws_broadcast(self, monkeypatch):
        from app.core import whatsapp_ws_manager as wsm

        sent = []

        async def fake_broadcast(uid, payload):
            sent.append((uid, payload))

        monkeypatch.setattr(wsm.whatsapp_ws_manager, "broadcast_to_user", fake_broadcast)
        self.broadcasts = sent

    def test_incoming_message_stored_and_chat_upserted(self, client, db):
        res = client.post(
            "/api/v1/whatsapp/webhook",
            json={
                "type": "message",
                "userId": "user-1",
                "chatId": "15551234567@s.whatsapp.net",
                "content": "Hello from a friend",
                "senderId": "15551234567@s.whatsapp.net",
                "senderName": "Friend",
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "processed"

        res_chats = client.get("/api/v1/whatsapp/chats", headers=_auth_headers())
        assert res_chats.status_code == 200, res_chats.text[:200]
        ids = [c["id"] for c in res_chats.json()]
        assert "15551234567@s.whatsapp.net" in ids

    def test_missing_ids_ignored(self, client, db):
        res = client.post("/api/v1/whatsapp/webhook", json={"type": "message"})
        assert res.json()["status"] == "ignored"

    def test_history_sync_persists_chats_and_messages(self, client, db):
        res = client.post(
            "/api/v1/whatsapp/webhook",
            json={
                "type": "history_sync",
                "userId": "user-1",
                "chats": [{"id": "g@us", "isGroup": True, "unreadCount": 2}],
                "messages": [
                    {
                        "id": "m1",
                        "chatId": "g@us",
                        "content": "synced text",
                        "senderId": "x@y",
                        "timestamp": "2026-08-25T10:00:00Z",
                    }
                ],
            },
        )
        body = res.json()
        assert body["chats"] == 1
        assert body["messages"] == 1

    def test_receipt_and_reaction_updates(self, client, db):
        receipt = client.post(
            "/api/v1/whatsapp/webhook",
            json={
                "type": "receipt_update",
                "userId": "user-1",
                "chatId": "c1",
                "messageIds": ["m1", "m2"],
                "status": "read",
            },
        )
        assert receipt.json()["status"] == "receipt_updated"

        reaction = client.post(
            "/api/v1/whatsapp/webhook",
            json={
                "type": "message_reaction",
                "userId": "user-1",
                "chatId": "c1",
                "messageId": "m1",
                "emoji": "+1",
                "senderId": "op",
            },
        )
        assert reaction.json()["status"] == "reaction_updated"

    def test_eve_mention_triggers_auto_reply(self, client, db, monkeypatch):
        handled = {}

        async def fake_eve_response(database, user_id, chat_id, content):
            handled.update(user_id=user_id, chat_id=chat_id, content=content)

        from app.services.whatsapp import WhatsAppService

        monkeypatch.setattr(
            WhatsAppService, "_handle_eve_response", staticmethod(fake_eve_response)
        )

        client.post(
            "/api/v1/whatsapp/webhook",
            json={
                "type": "message",
                "userId": "user-1",
                "chatId": "friend@s.whatsapp.net",
                "content": "@eve what is on my calendar?",
                "senderId": "friend@s.whatsapp.net",
                "senderName": "Friend",
            },
        )
        assert handled["user_id"] == "user-1"
        assert "@eve" in handled["content"]

    def test_plain_message_does_not_trigger_eve(self, client, db, monkeypatch):
        called = {"n": 0}

        async def fake_eve_response(*args, **kwargs):
            called["n"] += 1

        from app.services.whatsapp import WhatsAppService

        monkeypatch.setattr(
            WhatsAppService, "_handle_eve_response", staticmethod(fake_eve_response)
        )

        client.post(
            "/api/v1/whatsapp/webhook",
            json={
                "type": "message",
                "userId": "user-1",
                "chatId": "quiet@s.whatsapp.net",
                "content": "just chatting",
                "senderId": "q@s.whatsapp.net",
                "senderName": "Quiet",
            },
        )
        assert called["n"] == 0


class TestCronSecurity:
    def test_execute_schedules_requires_secret(self, client, db, monkeypatch):
        from tests.support.auth import override_settings

        # Discover the header name used by the route implementation
        import inspect

        from app.api.routes import cron as cron_module

        source = inspect.getsource(cron_module)
        if "x-cron-secret" in source.lower():
            secret_header = "X-Cron-Secret"
        else:  # pragma: no cover - fallback
            secret_header = "Authorization"

        with override_settings(cron_secret="unit-test-secret"):
            no_header = client.get("/api/v1/cron/execute-schedules")
            wrong_header = client.get(
                "/api/v1/cron/execute-schedules", headers={secret_header: "wrong"}
            )
            good_header = client.get(
                "/api/v1/cron/execute-schedules", headers={secret_header: "unit-test-secret"}
            )
        assert no_header.status_code in (401, 403)
        assert wrong_header.status_code in (401, 403)
        assert good_header.status_code in (200, 204)


class TestUnifiedModels:
    def test_route_responds_with_auth(self, auth_client, db, monkeypatch):
        res = auth_client.get("/api/v1/models")
        assert res.status_code in (200, 503)
