"""API tests: /documents routes against the real SQLite database."""

from datetime import datetime, timezone

import pytest


def doc_payload(name: str = "Spec", **overrides) -> dict:
    payload = {
        "name": name,
        "category": "Work",
        "description": "Design document",
        "tags": ["spec", "v2"],
        "type": "FILE",
        "size": "12 KB",
        "modified_at": datetime.now(timezone.utc).isoformat(),
        "url": "https://drive.example.com/file/abc",
    }
    payload.update(overrides)
    return payload


@pytest.fixture()
def saved(auth_client):
    res = auth_client.put("/api/v1/documents/doc-1", json=doc_payload())
    assert res.status_code == 200
    return res.json()


class TestDocumentCrud:
    def test_upsert_creates_document(self, saved):
        assert saved["id"] == "doc-1"
        assert saved["name"] == "Spec"
        assert saved["tags"] == ["spec", "v2"]

    def test_upsert_updates_existing(self, auth_client, saved):
        res = auth_client.put("/api/v1/documents/doc-1", json=doc_payload(name="Spec v3"))
        assert res.status_code == 200
        assert res.json()["name"] == "Spec v3"
        # still exactly one copy
        listed = auth_client.get("/api/v1/documents").json()
        assert len(listed) == 1

    def test_get_document(self, auth_client, saved):
        res = auth_client.get("/api/v1/documents/doc-1")
        assert res.status_code == 200
        assert res.json()["url"] == "https://drive.example.com/file/abc"

    def test_get_missing_404(self, auth_client):
        assert auth_client.get("/api/v1/documents/ghost").status_code == 404

    def test_invalid_id_with_slash_404(self, auth_client):
        """A slash cannot appear in a single path segment — router 404s first."""
        res = auth_client.put("/api/v1/documents/bad/id", json=doc_payload())
        assert res.status_code == 404

    def test_blank_id_rejected(self, auth_client):
        res = auth_client.put("/api/v1/documents/%20", json=doc_payload())
        assert res.status_code == 400

    def test_missing_required_fields_422(self, auth_client):
        res = auth_client.put("/api/v1/documents/doc-x", json={"name": "Only name"})
        assert res.status_code == 422

    def test_delete_then_restore(self, auth_client, saved):
        assert auth_client.delete("/api/v1/documents/doc-1").status_code == 204
        assert auth_client.get("/api/v1/documents/doc-1").status_code == 404
        restored = auth_client.post("/api/v1/documents/doc-1/restore")
        assert restored.status_code == 200
        assert restored.json()["id"] == "doc-1"

    def test_delete_missing_404(self, auth_client):
        assert auth_client.delete("/api/v1/documents/ghost").status_code == 404

    def test_list_excludes_deleted(self, auth_client, saved):
        other = auth_client.put("/api/v1/documents/doc-2", json=doc_payload("Other"))
        assert other.status_code == 200
        auth_client.delete("/api/v1/documents/doc-1")
        names = [d["name"] for d in auth_client.get("/api/v1/documents").json()]
        assert names == ["Other"]


class TestDocumentOwnership:
    def test_other_user_isolated(self, auth_client, saved, other_user_headers):
        res = auth_client.get("/api/v1/documents/doc-1", headers=other_user_headers)
        assert res.status_code == 404

        delete_res = auth_client.delete(
            "/api/v1/documents/doc-1", headers=other_user_headers
        )
        assert delete_res.status_code == 404

        # Owner's data untouched
        assert auth_client.get("/api/v1/documents/doc-1").status_code == 200


class TestDocumentPagination:
    def test_page_shape_and_cursor_walk(self, auth_client):
        for i in range(5):
            stamp = datetime.now(timezone.utc).isoformat()
            auth_client.put(f"/api/v1/documents/page-{i}", json=doc_payload(f"P{i}", modified_at=stamp))

        first = auth_client.get("/api/v1/documents", params={"limit": 2}).json()
        assert len(first["items"]) <= 2
        if first["has_more"]:
            second = auth_client.get(
                "/api/v1/documents", params={"limit": 2, "cursor": first["next_cursor"]}
            ).json()
            first_ids = {item["id"] for item in first["items"]}
            second_ids = {item["id"] for item in second["items"]}
            assert not first_ids & second_ids
