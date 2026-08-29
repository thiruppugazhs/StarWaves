"""API tests: /profiles routes (unauthenticated standalone CRUD) on real SQLite."""

import pytest

PROFILE_PAYLOAD = {
    "full_name": "Ada Lovelace",
    "first_name": "Ada",
    "initials": "AL",
    "email": "ada@example.com",
    "role": "engineer",
    "role_label": "Systems Engineer",
}


@pytest.fixture()
def created(client):
    res = client.post("/api/v1/profiles", json=PROFILE_PAYLOAD)
    assert res.status_code == 201
    return res.json()


class TestProfileCrud:
    def test_create_returns_201(self, created):
        assert created["full_name"] == "Ada Lovelace"
        assert created["id"]

    def test_get_profile(self, client, created):
        res = client.get(f"/api/v1/profiles/{created['id']}")
        assert res.status_code == 200
        assert res.json()["first_name"] == "Ada"

    def test_get_missing_404(self, client):
        assert client.get("/api/v1/profiles/ghost").status_code == 404

    def test_patch_updates_role(self, client, created):
        res = client.patch(f"/api/v1/profiles/{created['id']}", json={"role_label": "Principal Engineer"})
        assert res.status_code == 200
        body = res.json()
        assert body["role_label"] == "Principal Engineer"
        assert body["full_name"] == "Ada Lovelace"

    def test_empty_patch_rejected_422(self, client, created):
        assert client.patch(f"/api/v1/profiles/{created['id']}", json={}).status_code == 422

    def test_delete_then_missing(self, client, created):
        assert client.delete(f"/api/v1/profiles/{created['id']}").status_code == 204
        assert client.get(f"/api/v1/profiles/{created['id']}").status_code == 404
        assert client.delete(f"/api/v1/profiles/{created['id']}").status_code == 404


class TestProfileValidation:
    def test_invalid_email_422(self, client):
        bad = {**PROFILE_PAYLOAD, "email": "not-an-email"}
        assert client.post("/api/v1/profiles", json=bad).status_code == 422

    def test_initials_over_limit_422(self, client):
        bad = {**PROFILE_PAYLOAD, "initials": "TOOLONG"}
        assert client.post("/api/v1/profiles", json=bad).status_code == 422

    def test_list_profiles_respects_limit(self, client):
        for i in range(3):
            client.post(
                "/api/v1/profiles",
                json={**PROFILE_PAYLOAD, "email": f"p{i}@example.com"},
            )
        listed = client.get("/api/v1/profiles", params={"limit": 2}).json()
        assert len(listed) <= 2
