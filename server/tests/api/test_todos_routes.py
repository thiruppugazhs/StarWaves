"""API tests: /todos routes against the real SQLite database."""

import pytest

TODO_PAYLOAD = {"title": "Write E2E tests", "due_date": "2026-09-01"}


@pytest.fixture()
def created(auth_client):
    res = auth_client.post("/api/v1/todos", json=TODO_PAYLOAD)
    assert res.status_code == 201
    return res.json()


class TestTodoCrud:
    def test_create_returns_201_with_fields(self, created):
        assert created["title"] == "Write E2E tests"
        assert created["completed"] is False
        assert created["id"]

    def test_get_created_todo(self, auth_client, created):
        res = auth_client.get(f"/api/v1/todos/{created['id']}")
        assert res.status_code == 200
        assert res.json()["id"] == created["id"]

    def test_get_missing_todo_404(self, auth_client):
        assert auth_client.get("/api/v1/todos/nope").status_code == 404

    def test_patch_updates_completed(self, auth_client, created):
        res = auth_client.patch(f"/api/v1/todos/{created['id']}", json={"completed": True})
        assert res.status_code == 200
        assert res.json()["completed"] is True

    def test_patch_title(self, auth_client, created):
        res = auth_client.patch(f"/api/v1/todos/{created['id']}", json={"title": "Renamed"})
        assert res.json()["title"] == "Renamed"

    def test_empty_patch_rejected_422(self, auth_client, created):
        res = auth_client.patch(f"/api/v1/todos/{created['id']}", json={})
        assert res.status_code == 422

    def test_patch_missing_todo_404_no_phantom_create(self, auth_client):
        """Regression: updating a ghost id must not silently create a record."""
        res = auth_client.patch("/api/v1/todos/ghost-id", json={"completed": True})
        assert res.status_code == 404
        assert auth_client.get("/api/v1/todos").json() == []

    def test_delete_then_get_404(self, auth_client, created):
        assert auth_client.delete(f"/api/v1/todos/{created['id']}").status_code == 204
        assert auth_client.get(f"/api/v1/todos/{created['id']}").status_code == 404

    def test_delete_missing_404(self, auth_client):
        assert auth_client.delete("/api/v1/todos/ghost").status_code == 404

    def test_restore_after_delete(self, auth_client, created):
        auth_client.delete(f"/api/v1/todos/{created['id']}")
        restored = auth_client.post(f"/api/v1/todos/{created['id']}/restore")
        assert restored.status_code == 200
        assert auth_client.get(f"/api/v1/todos/{created['id']}").status_code == 200


class TestTodoList:
    def test_list_excludes_deleted(self, auth_client, created):
        auth_client.post("/api/v1/todos", json={"title": "keep me"})
        auth_client.delete(f"/api/v1/todos/{created['id']}")
        listed = auth_client.get("/api/v1/todos").json()
        titles = [t["title"] for t in listed]
        assert "keep me" in titles
        assert created["title"] not in titles

    def test_paginated_list_shape(self, auth_client):
        for i in range(3):
            auth_client.post("/api/v1/todos", json={"title": f"task {i}"})
        body = auth_client.get("/api/v1/todos", params={"limit": 2}).json()
        assert set(body) == {"items", "next_cursor", "has_more"}
        assert len(body["items"]) <= 2

    def test_limit_validation_rejects_over_50(self, auth_client):
        res = auth_client.get("/api/v1/todos", params={"limit": 500})
        assert res.status_code == 422

    def test_create_validates_empty_title_422(self, auth_client):
        res = auth_client.post("/api/v1/todos", json={"title": ""})
        assert res.status_code == 422

    def test_create_requires_auth(self, client, db):
        assert client.post("/api/v1/todos", json=TODO_PAYLOAD).status_code == 401


class TestTodoOwnership:
    """A user's todos are invisible to other authenticated users."""

    def test_second_user_cannot_read_or_mutate(self, auth_client, created, other_user_headers):
        read_res = auth_client.get(
            f"/api/v1/todos/{created['id']}", headers=other_user_headers
        )
        assert read_res.status_code == 404

        patch_res = auth_client.patch(
            f"/api/v1/todos/{created['id']}", json={"completed": True}, headers=other_user_headers
        )
        assert patch_res.status_code == 404

        delete_res = auth_client.delete(
            f"/api/v1/todos/{created['id']}", headers=other_user_headers
        )
        assert delete_res.status_code == 404

        original = auth_client.get(f"/api/v1/todos/{created['id']}")
        assert original.json()["completed"] is False
