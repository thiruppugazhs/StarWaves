"""API tests: workspace data routes (jobs, hackathons, notifications, calendar,
contests, coding stats) against the real SQLite database."""

from datetime import datetime, timedelta, timezone

import pytest

JOB_PAYLOAD = {
    "company": "Acme Corp",
    "role": "Frontend Engineer",
    "status": "Applied",
    "location": "Remote",
}


def future_dates(days: int = 30) -> dict:
    start = datetime.now(timezone.utc) + timedelta(days=days)
    return {
        "starts_at": start.isoformat(),
        "ends_at": (start + timedelta(days=2)).isoformat(),
    }


HACKATHON_PAYLOAD = {
    "title": "Global Hack Week",
    "organizer": "MLH",
    "mode": "online",
    **future_dates(14),
}


class TestJobsCrud:
    def test_create_get_patch_delete_restore(self, auth_client):
        created = auth_client.post("/api/v1/jobs", json=JOB_PAYLOAD).json()
        assert created["company"] == "Acme Corp"

        got = auth_client.get(f"/api/v1/jobs/{created['id']}")
        assert got.status_code == 200
        assert got.json()["role"] == "Frontend Engineer"

        patched = auth_client.patch(
            f"/api/v1/jobs/{created['id']}", json={"status": "Interview"}
        )
        assert patched.json()["status"] == "Interview"

        assert auth_client.delete(f"/api/v1/jobs/{created['id']}").status_code == 204
        assert auth_client.get(f"/api/v1/jobs/{created['id']}").status_code == 404

        restored = auth_client.post(f"/api/v1/jobs/{created['id']}/restore")
        assert restored.status_code == 200
        assert restored.json()["status"] == "Interview"

    def test_missing_job_404(self, auth_client):
        assert auth_client.get("/api/v1/jobs/ghost").status_code == 404

    def test_list_page_shape(self, auth_client):
        for i in range(3):
            auth_client.post("/api/v1/jobs", json={**JOB_PAYLOAD, "company": f"C{i}"})
        body = auth_client.get("/api/v1/jobs", params={"limit": 2}).json()
        assert set(body) >= {"items", "next_cursor", "has_more"}

    def test_ownership_isolation(self, auth_client, other_user_headers):
        created = auth_client.post("/api/v1/jobs", json=JOB_PAYLOAD).json()
        res = auth_client.get(f"/api/v1/jobs/{created['id']}", headers=other_user_headers)
        assert res.status_code == 404


class TestHackathonSources:
    def test_list_sources_default_disabled(self, auth_client):
        res = auth_client.get("/api/v1/hackathon-sources")
        assert res.status_code == 200
        sources = res.json()["sources"]
        assert len(sources) > 0
        assert all(source["enabled"] is False for source in sources)

    def test_toggle_enable_disable_round_trip(self, auth_client):
        source_id = auth_client.get("/api/v1/hackathon-sources").json()["sources"][0]["id"]

        on = auth_client.put(f"/api/v1/hackathon-sources/{source_id}", params={"enabled": True})
        assert on.status_code == 200 and on.json()["enabled"] is True

        enabled_ids = {
            s["id"] for s in auth_client.get("/api/v1/hackathon-sources").json()["sources"] if s["enabled"]
        }
        assert source_id in enabled_ids

        off = auth_client.put(f"/api/v1/hackathon-sources/{source_id}", params={"enabled": False})
        assert off.json()["enabled"] is False

    def test_unknown_source_404(self, auth_client):
        res = auth_client.put("/api/v1/hackathon-sources/nope", params={"enabled": True})
        assert res.status_code == 404


class TestHackathonsCrud:
    def test_create_get(self, auth_client):
        created = auth_client.post("/api/v1/hackathons", json=HACKATHON_PAYLOAD).json()
        assert created["title"] == "Global Hack Week"

        got = auth_client.get(f"/api/v1/hackathons/{created['id']}")
        assert got.status_code == 200
        assert got.json()["organizer"] == "MLH"

    def test_patch_and_delete_restore(self, auth_client):
        created = auth_client.post("/api/v1/hackathons", json=HACKATHON_PAYLOAD).json()

        patched = auth_client.patch(
            f"/api/v1/hackathons/{created['id']}", json={"team_size": "4"}
        )
        assert patched.status_code == 200

        assert auth_client.delete(f"/api/v1/hackathons/{created['id']}").status_code == 204
        assert auth_client.get(f"/api/v1/hackathons/{created['id']}").status_code == 404
        assert auth_client.post(f"/api/v1/hackathons/{created['id']}/restore").status_code == 200

    def test_missing_hackathon_404(self, auth_client):
        assert auth_client.get("/api/v1/hackathons/ghost").status_code == 404

    def test_list_includes_future_manual_hackathons(self, auth_client, monkeypatch):
        from app.api.routes.workspace import hackathons as hack_module

        async def _no_fetch(enabled): return []
        monkeypatch.setattr(hack_module, "fetch_enabled_hackathons", _no_fetch)

        created = auth_client.post("/api/v1/hackathons", json=HACKATHON_PAYLOAD).json()
        listed = auth_client.get("/api/v1/hackathons").json()
        ids = [item["id"] for item in listed["items"]]
        assert created["id"] in ids
        manual_entry = next(item for item in listed["items"] if item["id"] == created["id"])
        assert manual_entry["source"] == "manual"

    def test_past_hackathons_filtered_out(self, auth_client, monkeypatch):
        from app.api.routes.workspace import hackathons as hack_module

        async def _no_fetch(enabled): return []
        monkeypatch.setattr(hack_module, "fetch_enabled_hackathons", _no_fetch)
        past = {**HACKATHON_PAYLOAD, **future_dates(-10)}
        auth_client.post("/api/v1/hackathons", json=past)

        assert auth_client.get("/api/v1/hackathons").json()["items"] == []


class TestNotificationsApi:
    def test_crud_and_mark_all_read(self, client, db):
        from tests.support.auth import auth_headers
        from tests.support.db import get_sql_client

        database = get_sql_client()
        headers = auth_headers()
        uid = "user-1"

        # Seed directly through the repository used by the route
        from app.repositories import NotificationRepository

        repo = NotificationRepository(database, uid)
        repo.create(type="call", title="Call from Eve", message="Incoming call")

        listed = client.get("/api/v1/notifications", headers=headers).json()
        assert listed["has_more"] in (True, False)
        assert len(listed["items"]) == 1
        nid = listed["items"][0]["id"]
        assert listed["items"][0]["unread"] is True or listed["items"][0]["read"] is False

        marked = client.patch(f"/api/v1/notifications/{nid}", json={"unread": False}, headers=headers)
        assert marked.status_code == 200

        all_read = client.post("/api/v1/notifications/mark-all-read", headers=headers).json()
        assert all_read["updated"] >= 1

        deleted = client.delete(f"/api/v1/notifications/{nid}", headers=headers)
        assert deleted.status_code == 204

    def test_notification_404s(self, client, db):
        from tests.support.auth import auth_headers

        headers = auth_headers()
        assert client.get("/api/v1/notifications/ghost", headers=headers).status_code == 404
        assert (
            client.patch("/api/v1/notifications/ghost", json={"unread": False}, headers=headers).status_code
            == 404
        )
        assert client.delete("/api/v1/notifications/ghost", headers=headers).status_code == 404


class TestCalendarData:
    def test_aggregates_projects_jobs_hackathons(self, auth_client, monkeypatch):
        from app.api.routes.workspace import calendar as cal_module

        async def _cal_no_fetch(enabled): return []
        monkeypatch.setattr(cal_module, "fetch_enabled_hackathons", _cal_no_fetch)

        auth_client.post("/api/v1/projects", json={"name": "Cal Proj"})
        auth_client.post("/api/v1/jobs", json=JOB_PAYLOAD)
        auth_client.post("/api/v1/hackathons", json=HACKATHON_PAYLOAD)

        data = auth_client.get("/api/v1/calendar-data").json()
        assert any(p.get("name") == "Cal Proj" for p in data["projects"])
        assert any(j.get("company") == "Acme Corp" for j in data["jobs"])
        assert all("source" in h for h in data["hackathons"])

    def test_requires_auth(self, client, db):
        assert client.get("/api/v1/calendar-data").status_code == 401


class TestContestsRoute:
    def test_merges_platforms_sorted_with_pagination(self, client, monkeypatch):
        from app.api.routes.workspace import contests as contests_module

        async def fake_cf(client):
            return {"id": "codeforces", "contests": [
                {"id": "cf-2", "name": "CF Later", "startsAt": "2026-09-02T00:00:00Z"},
                {"id": "cf-1", "name": "CF Early", "startsAt": "2026-09-01T00:00:00Z"},
            ]}

        async def fake_cc(client):
            return {"id": "codechef", "contests": [
                {"id": "cc-1", "name": "CC Mid", "startsAt": "2026-09-01T12:00:00Z"},
            ]}

        async def fake_ll(client):
            return None  # platform failure tolerated → filtered out

        monkeypatch.setattr(contests_module, "codeforces_contests", fake_cf)
        monkeypatch.setattr(contests_module, "codechef_contests", fake_cc)
        monkeypatch.setattr(contests_module, "leetcode_contests", fake_ll)
        contests_module._contest_cache = None

        page = client.get("/api/v1/contests", params={"limit": 2}).json()
        names = [item["name"] for item in page["items"]]
        assert names == ["CF Early", "CC Mid"]
        assert page["has_more"] is True
        assert page["next_cursor"]

        second = client.get(
            "/api/v1/contests", params={"limit": 5, "cursor": page["next_cursor"]}
        ).json()
        assert [item["name"] for item in second["items"]] == ["CF Later"]
        assert second["has_more"] is False

    def test_all_platforms_failing_returns_empty(self, client, monkeypatch):
        from app.api.routes.workspace import contests as contests_module

        async def none_platform(client):
            return None

        for fn in ("codeforces_contests", "codechef_contests", "leetcode_contests"):
            monkeypatch.setattr(contests_module, fn, none_platform)
        contests_module._contest_cache = None

        page = client.get("/api/v1/contests").json()
        assert page["items"] == []
        assert page["has_more"] is False


class TestCodingStatsRoutes:
    def test_stats_route_uses_saved_settings(self, auth_client, monkeypatch):
        from app.api.routes.coding_stats import coding_settings as _  # noqa: F401
        from app.api.routes import coding_stats as stats_module

        captured = {}

        async def fake_load(settings):
            captured.update(settings)
            return {"codeforces": {"handle": captured.get("codeforces")}}

        async def fake_platform(platform, handle):
            return {"platform": platform, "handle": handle}

        monkeypatch.setattr(stats_module, "load_coding_stats", fake_load)
        monkeypatch.setattr(stats_module, "load_platform_coding_stats", fake_platform)

        # Persist competitive-coding settings through the compat layer
        from tests.support.db import get_sql_client

        database = get_sql_client()
        database.collection("users").document("user-1").collection("settings").document(
            "competitive-coding"
        ).set({"codeforces": "tourist", "codechef": "chef_user"})

        overall = auth_client.get("/api/v1/stats/competitive-coding")
        assert overall.status_code == 200
        assert captured["codeforces"] == "tourist"

        cf = auth_client.get("/api/v1/stats/competitive-coding/codeforces").json()
        assert cf == {"platform": "codeforces", "handle": "tourist"}

        leetcode = auth_client.get("/api/v1/stats/competitive-coding/leetcode").json()
        assert leetcode == {"platform": "leetcode", "handle": ""}

