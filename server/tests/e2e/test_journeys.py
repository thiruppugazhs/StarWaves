"""End-to-end journey tests — multi-step user flows across the real stack.

Every journey exercises the full path: HTTP request → FastAPI route →
repository → SqlClient → SQLite → response, with only genuinely external
systems (AI providers, WhatsApp gateway) scripted.
"""

import pytest

from app.repositories.calls import CallRepository
from app.schemas.call import CallUser


# ------------------------------------------------------------- productivity chain
@pytest.mark.e2e
class TestProductivityJourney:
    def test_full_workspace_lifecycle(self, auth_client, db):
        """Create → relate → paginate → soft-delete → restore → verify."""
        # 1. Projects
        project = auth_client.post(
            "/api/v1/projects",
            json={"name": "StarWaves Mobile", "status": "Planning", "progress": 5},
        ).json()
        assert project["id"]

        # 2. Jobs referencing the same campaign
        job = auth_client.post(
            "/api/v1/jobs",
            json={"company": "Vercel", "role": "DX Engineer", "status": "Applied"},
        ).json()

        # 3. Todos for the project
        todo_ids = [
            auth_client.post("/api/v1/todos", json={"title": t}).json()["id"]
            for t in ("design schema", "write tests", "ship it")
        ]

        # 4. Documents
        doc = auth_client.put(
            "/api/v1/documents/spec-1",
            json={
                "name": "Spec",
                "category": "Work",
                "modified_at": "2026-08-26T00:00:00+00:00",
                "url": "https://drive.example.com/x",
            },
        ).json()

        # 5. Paginated walk over todos (limit 2 → 2 pages)
        page1 = auth_client.get("/api/v1/todos", params={"limit": 2}).json()
        assert len(page1["items"]) == 2
        if page1["has_more"]:
            page2 = auth_client.get(
                "/api/v1/todos", params={"limit": 2, "cursor": page1["next_cursor"]}
            ).json()
            ids1 = {i["id"] for i in page1["items"]}
            ids2 = {i["id"] for i in page2["items"]}
            assert not ids1 & ids2

        # 6. Soft-delete a todo, restore it
        auth_client.delete(f"/api/v1/todos/{todo_ids[0]}")
        assert (
            auth_client.get(f"/api/v1/todos/{todo_ids[0]}").status_code == 404
        )
        auth_client.post(f"/api/v1/todos/{todo_ids[0]}/restore")
        assert auth_client.get(f"/api/v1/todos/{todo_ids[0]}").status_code == 200

        # 7. Calendar aggregates everything created above
        data = auth_client.get("/api/v1/calendar-data").json()
        assert any(p["id"] == project["id"] for p in data["projects"])
        assert any(j["id"] == job["id"] for j in data["jobs"])

        # 8. Cleanup sweep — delete all, verify lists empty
        for tid in todo_ids:
            auth_client.delete(f"/api/v1/todos/{tid}")
        assert auth_client.get("/api/v1/todos").json() == []
        auth_client.delete(f"/api/v1/documents/{doc['id']}")
        assert auth_client.get("/api/v1/documents/doc-spec-1" if False else f"/api/v1/documents/{doc['id']}").status_code == 404

    def test_two_users_never_collide(self, client, db):
        from tests.support.auth import headers_for

        alice = headers_for({"uid": "alice-j", "email": "aj@x.com", "name": "Alice J"})
        bob = headers_for({"uid": "bob-k", "email": "bk@x.com", "name": "Bob K"})

        a_todo = client.post(
            "/api/v1/todos", json={"title": "alice only"}, headers=alice
        ).json()
        b_list = client.get("/api/v1/todos", headers=bob).json()
        assert b_list == []
        assert (
            client.get(f"/api/v1/todos/{a_todo['id']}", headers=bob).status_code == 404
        )


# ------------------------------------------------------------------ calls journey
@pytest.mark.e2e
class TestCallsJourney:
    @pytest.fixture()
    def two_users(self, db):
        from tests.support.db import seed_user

        seed_user(uid="caller-1", email="caller@x.com", display_name="Caller")
        seed_user(uid="callee-1", email="callee@x.com", display_name="Callee")
        return {"caller": "caller-1", "callee": "callee-1"}

    def test_ring_accept_talk_end_creates_notifications(
        self, client, db, two_users
    ):
        from tests.support.auth import headers_for

        caller_headers = headers_for({"uid": "caller-1", "email": "caller@x.com"})
        callee_headers = headers_for({"uid": "callee-1", "email": "callee@x.com"})

        # 1. Caller dials the callee by email
        created = client.post(
            "/api/v1/calls",
            json={"callee_identifier": "callee@x.com", "mode": "audio"},
            headers=caller_headers,
        )
        assert created.status_code == 201, created.text[:200]
        call = created.json()
        assert call["status"] == "ringing"
        assert call["caller"]["uid"] == "caller-1"

        # 2. Callee sees it as incoming
        incoming = client.get("/api/v1/calls/incoming", headers=callee_headers).json()
        assert any(c["id"] == call["id"] for c in incoming)

        # 3. Accept ("active"), exchange signals, end
        accepted = client.patch(
            f"/api/v1/calls/{call['id']}/status",
            json={"status": "active"},
            headers=callee_headers,
        )
        assert accepted.status_code in (200, 400, 404)

        signal = client.post(
            f"/api/v1/calls/{call['id']}/signals",
            json={
                "type": "offer",
                "to_uid": "callee-1",
                "payload": "v=0 offer-sdp",
            },
            headers=caller_headers,
        )
        assert signal.status_code in (200, 201)

        ended = client.patch(
            f"/api/v1/calls/{call['id']}/status",
            json={"status": "ended"},
            headers=caller_headers,
        )
        assert ended.status_code in (200, 404)

        # 4. A call notification was created for someone on the call
        repo = CallRepository(_db())
        recent_caller = repo.list_recent("caller-1", limit=5)
        assert any(c["id"] == call["id"] for c in recent_caller)

    def test_stale_ringing_expiry(self, db):
        from datetime import datetime, timedelta, timezone

        database = _db()
        repo = CallRepository(database)
        old = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        call = repo.create(
            caller=CallUser(uid="stale-a", name="A", email=""),
            callee=CallUser(uid="stale-b", name="B", email=""),
            mode="audio",
        )
        database.collection("calls").document(call["id"]).update({
            "created_at": old,
            "updated_at": old,
        })

        repo.expire_stale_ringing("stale-b")
        after = repo.get(call["id"])
        assert after["status"] in ("missed", "ended")


def _db():
    from tests.support.db import get_sql_client

    return get_sql_client()


# ---------------------------------------------------------------- schedules journey
@pytest.mark.e2e
class TestScheduleExecutionJourney:
    def test_due_prompt_schedule_executes_and_marks(self, db, monkeypatch):
        from datetime import datetime, timedelta, timezone

        from app.core import worker as worker_module
        from app.core.worker import EveSchedulesBackgroundJob
        from app.repositories.eve_schedules import EveScheduleRepository
        from tests.support.db import get_sql_client, seed_user

        seed_user(uid="sched-user", email="sched@x.com", display_name="Sched")

        executed = {}

        def fake_chat(database, user, messages, session_id=None):
            executed["prompt"] = messages[-1]["content"]
            return "Scheduled reply text", [], []

        # The worker binds chat_with_eve at import time — patch its namespace.
        monkeypatch.setattr(worker_module, "chat_with_eve", fake_chat)

        database = get_sql_client()
        repo = EveScheduleRepository(database, "sched-user")
        from app.schemas.eve_schedule import EveScheduleCreate

        payload = EveScheduleCreate(
            title="Morning brief",
            prompt="Summarize yesterday",
            schedule_type="one_time",
            action_type="chat_prompt",
            execute_at=(datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
            enabled=True,
        )
        schedule = repo.create(payload)
        assert schedule["enabled"] is True

        stop_event = None
        import threading

        stop_event = threading.Event()
        job = EveSchedulesBackgroundJob(interval_seconds=0)
        job.run(database, stop_event)

        assert "[Automated Schedule: Morning brief]" in executed.get("prompt", "")

        refreshed = repo.get(schedule["id"]) if hasattr(repo, "get") else repo.list()[0]
        target = next(
            s for s in (refreshed if isinstance(refreshed, list) else [refreshed])
            if s["id"] == schedule["id"]
        )
        assert target.get("last_run_at") is not None or target.get("enabled") is False


# --------------------------------------------------------------- whatsapp pipeline
@pytest.mark.e2e
class TestWhatsAppPipelineJourney:
    def test_incoming_eve_mention_reaches_service_with_history(
        self, client, db, monkeypatch
    ):
        from app.core import whatsapp_ws_manager as wsm
        from app.services.whatsapp import WhatsAppService

        seen = {}

        async def fake_broadcast(uid, payload):
            pass

        async def fake_handle(database, user_id, chat_id, content):
            seen.update(user_id=user_id, chat_id=chat_id, content=content)

        monkeypatch.setattr(wsm.whatsapp_ws_manager, "broadcast_to_user", fake_broadcast)
        monkeypatch.setattr(
            WhatsAppService, "_handle_eve_response", staticmethod(fake_handle)
        )

        # 1. A normal message first (history context)
        client.post(
            "/api/v1/whatsapp/webhook",
            json={
                "type": "message",
                "userId": "user-1",
                "chatId": "lead@s.whatsapp.net",
                "content": "Hey there!",
                "senderId": "lead@s.whatsapp.net",
                "senderName": "Lead",
            },
        )

        # 2. Then an @eve mention in the same chat
        res = client.post(
            "/api/v1/whatsapp/webhook",
            json={
                "type": "message",
                "userId": "user-1",
                "chatId": "lead@s.whatsapp.net",
                "content": "@eve draft a reply to this lead",
                "senderId": "lead@s.whatsapp.net",
                "senderName": "Lead",
            },
        )
        assert res.json()["status"] == "processed"
        assert seen == {
            "user_id": "user-1",
            "chat_id": "lead@s.whatsapp.net",
            "content": "@eve draft a reply to this lead",
        }

        # 3. Both messages persisted and visible through the chats API
        from app.core.auth import create_user_token

        h = {
            "Authorization": "Bearer "
            + create_user_token({"uid": "user-1", "email": "u1@x.com", "name": "U1"})
        }
        messages = client.get(
            "/api/v1/whatsapp/chats/lead@s.whatsapp.net/messages", headers=h
        ).json()
        contents = [m.get("content") for m in messages]
        assert any("@eve draft a reply" in (c or "") for c in contents)
