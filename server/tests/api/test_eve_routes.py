"""API tests: /eve routes — blocking chat with scripted providers (real SQLite)."""

import pytest

from tests.support.fakes import (
    ScriptedProvider,
    simple_config,
    text_round,
)
from app.services.ai_models.contracts import ProviderResponse, ToolCall


def make_provider(text="Here is your answer.", tool_calls=None) -> ScriptedProvider:
    return ScriptedProvider([ProviderResponse(text=text, tool_calls=tool_calls or [])])


@pytest.fixture()
def eve_pipeline(monkeypatch):
    """Patch the chat orchestrator's provider resolution + auto-memory.

    Returns an object whose ``.provider`` holds the scripted provider so tests
    can script rounds and inspect calls.
    """
    holder = {}

    def install(provider, config=None):
        from app.services.eve import chat as eve_chat
        from app.services.eve.chat_context import ChatContext

        holder["provider"] = provider

        def fake_resolve(database, user_id, messages):
            return ChatContext(
                database=database,
                user_id=user_id,
                instructions="test-instructions",
                config=config or simple_config(),
                client=provider,
                conversation=list(messages),
            )

        monkeypatch.setattr(eve_chat, "resolve_chat_context", fake_resolve)
        monkeypatch.setattr(
            eve_chat, "extract_and_save_memories", lambda *a, **k: []
        )
        return holder

    return install


class TestEveChatBlocking:
    def test_plain_reply(self, auth_client, db, eve_pipeline, monkeypatch):
        from app.services.eve import chat as eve_chat

        monkeypatch.setattr(eve_chat, "any_provider_available", lambda: True)
        eve_pipeline(make_provider("Hello from Eve"))

        res = auth_client.post(
            "/api/v1/eve/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["message"] == "Hello from Eve"
        assert body["changed_resources"] == []

    def test_tool_loop_creates_resource_via_dispatcher(
        self, auth_client, db, eve_pipeline, monkeypatch
    ):
        """Scripted provider requests create_todo; dispatcher executes against real DB."""
        from app.services.eve import chat as eve_chat

        monkeypatch.setattr(eve_chat, "any_provider_available", lambda: True)
        provider = make_provider("Done — created it.")
        # Round 1 asks for the tool; run_tool_loop then dispatches and continues
        provider.rounds = [
            ProviderResponse(
                text=None,
                raw=None,
                tool_calls=[
                    ToolCall(
                        call_id="c1",
                        name="create_workspace_record",
                        arguments={"resource": "todo", "data": {"title": "From Eve"}},
                    )
                ],
            ),
            ProviderResponse(text="Created your todo.", tool_calls=[], raw=None),
        ]
        eve_pipeline(provider)

        res = auth_client.post(
            "/api/v1/eve/chat",
            json={"messages": [{"role": "user", "content": "add a todo"}]},
        )
        assert res.status_code == 200
        assert res.json()["message"] == "Created your todo."
        assert "todos" in (res.json().get("changed_resources") or [])

        # The tool really wrote to SQLite through the compat layer
        listed = auth_client.get("/api/v1/todos").json()
        assert any(t["title"] == "From Eve" for t in listed)

    def test_unknown_session_404(self, auth_client, db, eve_pipeline, monkeypatch):
        from app.services.eve import chat as eve_chat

        monkeypatch.setattr(eve_chat, "any_provider_available", lambda: True)
        eve_pipeline(make_provider())
        res = auth_client.post(
            "/api/v1/eve/chat",
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "session_id": "ghost-session",
            },
        )
        assert res.status_code == 404

    def test_no_provider_configured_503(self, auth_client, db, monkeypatch):
        from app.services.eve import chat as eve_chat

        monkeypatch.setattr(eve_chat, "any_provider_available", lambda: False)
        res = auth_client.post(
            "/api/v1/eve/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
        assert res.status_code == 503

    def test_ai_service_error_maps_to_502(self, auth_client, db, eve_pipeline, monkeypatch):
        from app.services.ai_models.contracts import AIServiceError
        from app.services.ai_models.loop import run_tool_loop
        from app.services.eve import chat as eve_chat

        monkeypatch.setattr(eve_chat, "any_provider_available", lambda: True)
        eve_pipeline(make_provider())
        monkeypatch.setattr(
            eve_chat,
            "run_tool_loop",
            lambda *a, **k: (_ for _ in ()).throw(AIServiceError("boom")),
        )
        res = auth_client.post(
            "/api/v1/eve/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
        assert res.status_code == 502

    def test_messages_required_422(self, auth_client, db):
        res = auth_client.post("/api/v1/eve/chat", json={})
        assert res.status_code == 422


class TestEveSessionsRealDb:
    def test_create_list_get_delete_session_round_trip(self, auth_client, db):
        created = auth_client.post(
            "/api/v1/eve/sessions",
            json={"messages": [{"role": "user", "content": "Plan my sprint"}]},
        )
        assert created.status_code == 201
        session = created.json()["session"]
        assert session["title"] == "Plan my sprint"

        listing = auth_client.get("/api/v1/eve/sessions").json()["sessions"]
        assert any(s["id"] == session["id"] for s in listing)

        got = auth_client.get(f"/api/v1/eve/sessions/{session['id']}")
        assert got.status_code == 200

        assert auth_client.delete(f"/api/v1/eve/sessions/{session['id']}").status_code == 204
        assert auth_client.get(f"/api/v1/eve/sessions/{session['id']}").status_code == 404

    def test_sessions_scoped_per_user(self, auth_client, other_user_headers):
        created = auth_client.post(
            "/api/v1/eve/sessions", json={"messages": []}
        ).json()["session"]
        other_res = auth_client.get(
            f"/api/v1/eve/sessions/{created['id']}", headers=other_user_headers
        )
        assert other_res.status_code == 404


class TestEveMemoriesRealDb:
    def test_create_search_delete_memory(self, auth_client, db):
        made = auth_client.post(
            "/api/v1/eve/memories", json={"content": "Prefers dark mode"}
        )
        assert made.status_code == 201
        memories = made.json()["memories"]
        target = next(m for m in memories if m["content"] == "Prefers dark mode")

        deleted = auth_client.delete(f"/api/v1/eve/memories/{target['id']}")
        assert deleted.status_code == 200


class TestEveSchedulesApi:
    def test_schedule_crud_round_trip(self, auth_client, db):
        payload = {
            "title": "Monday summary",
            "prompt": "Summarize my week",
            "schedule_type": "recurring",
            "action_type": "chat_prompt",
            "cron_expression": "0 9 * * 1",
            "enabled": True,
        }
        created = auth_client.post("/api/v1/eve/schedules", json=payload)
        assert created.status_code == 201
        schedule = created.json()

        listing = auth_client.get("/api/v1/eve/schedules").json()["schedules"]
        assert any(s["id"] == schedule["id"] for s in listing)

        updated = auth_client.patch(
            f"/api/v1/eve/schedules/{schedule['id']}", json={"enabled": False}
        )
        assert updated.status_code == 200
        assert updated.json()["enabled"] is False

        assert (
            auth_client.delete(f"/api/v1/eve/schedules/{schedule['id']}").status_code == 204
        )

    def test_missing_schedule_404s(self, auth_client, db):
        assert auth_client.patch(
            "/api/v1/eve/schedules/ghost", json={"enabled": False}
        ).status_code == 404
        assert auth_client.delete("/api/v1/eve/schedules/ghost").status_code == 404

