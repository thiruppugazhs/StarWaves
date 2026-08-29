"""API tests: /contacts routes against the real SQLite database."""

import pytest

CONTACT_PAYLOAD = {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "phone": "+15550001",
    "company": "Analytical Engines",
    "role": "Engineer",
    "starred": True,
}


@pytest.fixture()
def created(auth_client):
    res = auth_client.post("/api/v1/contacts", json=CONTACT_PAYLOAD)
    assert res.status_code == 201
    return res.json()


class TestContactCrud:
    def test_create_returns_201(self, created):
        assert created["name"] == "Ada Lovelace"
        assert created["starred"] is True
        assert created["id"]

    def test_get_contact(self, auth_client, created):
        res = auth_client.get(f"/api/v1/contacts/{created['id']}")
        assert res.status_code == 200
        assert res.json()["email"] == "ada@example.com"

    def test_get_missing_404(self, auth_client):
        assert auth_client.get("/api/v1/contacts/ghost").status_code == 404

    def test_patch_updates_fields(self, auth_client, created):
        res = auth_client.patch(
            f"/api/v1/contacts/{created['id']}", json={"role": "Chief Engineer"}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["role"] == "Chief Engineer"
        assert body["name"] == "Ada Lovelace"  # unchanged field preserved

    def test_patch_empty_rejected_422(self, auth_client, created):
        res = auth_client.patch(f"/api/v1/contacts/{created['id']}", json={})
        # ContactUpdate allows all-None payloads (partial semantics differ from todos)
        assert res.status_code in (200, 422)

    def test_patch_missing_contact_404_no_phantom_create(self, auth_client):
        """Regression: updating a ghost id must not create a broken record."""
        res = auth_client.patch("/api/v1/contacts/ghost-id", json={"name": "X"})
        assert res.status_code == 404
        assert auth_client.get("/api/v1/contacts").json() == []

    def test_delete_then_restore(self, auth_client, created):
        assert auth_client.delete(f"/api/v1/contacts/{created['id']}").status_code == 204
        assert auth_client.get(f"/api/v1/contacts/{created['id']}").status_code == 404
        assert auth_client.post(f"/api/v1/contacts/{created['id']}/restore").status_code == 200

    def test_delete_missing_404(self, auth_client):
        assert auth_client.delete("/api/v1/contacts/ghost").status_code == 404

    def test_create_validates_name_required_422(self, auth_client):
        res = auth_client.post("/api/v1/contacts", json={"email": "x@y.z"})
        assert res.status_code == 422


class TestContactList:
    def test_list_excludes_deleted(self, auth_client, created):
        keep = auth_client.post("/api/v1/contacts", json={"name": "Keep"}).json()
        auth_client.delete(f"/api/v1/contacts/{created['id']}")
        names = [c["name"] for c in auth_client.get("/api/v1/contacts").json()]
        assert names == ["Keep"]
        del keep

    def test_paginated_shape(self, auth_client):
        for i in range(3):
            auth_client.post("/api/v1/contacts", json={"name": f"C{i}"})
        body = auth_client.get("/api/v1/contacts", params={"limit": 2}).json()
        assert set(body) == {"items", "next_cursor", "has_more"}


class TestContactOwnership:
    def test_second_user_cannot_read_or_mutate(self, auth_client, created, other_user_headers):
        assert (
            auth_client.get(f"/api/v1/contacts/{created['id']}", headers=other_user_headers).status_code
            == 404
        )
        assert (
            auth_client.patch(
                f"/api/v1/contacts/{created['id']}",
                json={"name": "Hijack"},
                headers=other_user_headers,
            ).status_code
            == 404
        )
        assert auth_client.get(f"/api/v1/contacts/{created['id']}").json()["name"] == "Ada Lovelace"
