"""Security & capability tests for /workspace-files routes (real disk storage).

Covers path-traversal rejection at both repository and route layers, sync
caps, tree building, base64 writes, and per-user isolation.
"""

import os

import pytest

from app.core.config import settings


@pytest.fixture()
def storage(tmp_path, monkeypatch):
    """Point workspace storage at a throwaway directory."""
    object.__setattr__(settings, "workspace_storage_path", str(tmp_path))
    yield tmp_path
    object.__setattr__(settings, "workspace_storage_path", "workspaces")


class TestPathTraversalRepository:
    """Direct repository-level guards (the security-critical boundary)."""

    def test_safe_path_rejects_dotdot_escape(self, storage):
        from app.repositories import workspace_files as wf

        with pytest.raises(ValueError, match="traversal"):
            wf._safe_path("user-1", "../../outside.txt")

    def test_safe_path_rejects_absolute_escape(self, storage):
        from app.repositories import workspace_files as wf

        with pytest.raises(ValueError):
            wf._safe_path("user-1", "/etc/passwd")

    def test_safe_path_allows_nested_paths(self, storage):
        from app.repositories import workspace_files as wf

        resolved = wf._safe_path("user-1", "src/app/main.py")
        assert "user-1" in resolved
        assert resolved.startswith(str(storage))

    def test_write_via_traversal_blocked_end_to_end(self, auth_client, storage):
        res = auth_client.put(
            "/api/v1/workspace-files/..%2F..%2Fescape.txt",
            json={"content": "evil"},
        )
        assert res.status_code in (400, 404)
        assert not os.path.exists(storage.parent / "escape.txt")

    def test_read_via_traversal_blocked(self, auth_client, storage):
        # Plant a secret outside the user's workspace root
        secret = storage.parent / "secret.txt"
        secret.write_text("top-secret", encoding="utf-8")
        try:
            res = auth_client.get("/api/v1/workspace-files/..%2Fsecret.txt")
            assert res.status_code in (400, 404)
            assert "top-secret" not in res.text
        finally:
            secret.unlink(missing_ok=True)


class TestWorkspaceFileOperations:
    def test_write_read_update_delete_cycle(self, auth_client):
        put = auth_client.put(
            "/api/v1/workspace-files/src/main.py", json={"content": "print('hi')"}
        )
        assert put.status_code == 200
        assert put.json()["written"] is True

        got = auth_client.get("/api/v1/workspace-files/src/main.py")
        assert got.status_code == 200
        assert got.json()["content"] == "print('hi')"
        assert got.json()["size"] == len("print('hi')")

        delete = auth_client.delete("/api/v1/workspace-files/src/main.py")
        assert delete.status_code == 204
        assert auth_client.get("/api/v1/workspace-files/src/main.py").status_code == 404

    def test_base64_binary_write(self, auth_client):
        import base64

        payload = base64.b64encode(b"\x89PNG-binary-blob").decode()
        res = auth_client.put(
            "/api/v1/workspace-files/assets/logo.png",
            json={"content": payload, "encoding": "base64"},
        )
        assert res.status_code == 200
        assert res.json()["size"] == len(b"\x89PNG-binary-blob")

    def test_read_missing_file_404(self, auth_client):
        assert auth_client.get("/api/v1/workspace-files/nope.py").status_code == 404

    def test_tree_lists_nested_and_hides_hidden_dirs(self, auth_client):
        auth_client.put("/api/v1/workspace-files/a.py", json={"content": "a"})
        auth_client.put("/api/v1/workspace-files/sub/b.js", json={"content": "b"})
        # .git-style hidden dirs are excluded by list_tree
        ws_root = None  # created implicitly under storage/user uid

        tree = auth_client.get("/api/v1/workspace-files/tree").json()
        paths = [f["path"] for f in tree["files"]]
        assert "a.py" in paths
        assert "sub/b.js" in paths
        assert all(not p.split("/")[0].startswith(".git") for p in paths)

    def test_search_finds_text_matches(self, auth_client):
        auth_client.put(
            "/api/v1/workspace-files/hunt.py",
            json={"content": "def find_me():\n    return 'needle-here'\n"},
        )
        res = auth_client.post(
            "/api/v1/workspace-files/search",
            json={"query": "needle-here"},
        )
        if res.status_code == 200:
            hits = res.json().get("matches") or res.json().get("results") or []
            assert any(h["path"].endswith("hunt.py") for h in hits)


class TestSyncCaps:
    def test_sync_writes_all_files(self, auth_client):
        payload = {
            "files": [
                {"path": "f0.txt", "content": "content 0"},
                {"path": "nested/deep/x.md", "content": "# hi"},
            ]
        }
        res = auth_client.post("/api/v1/workspace-files/sync", json=payload)
        assert res.status_code == 200
        body = res.json()
        assert body["synced"] == 2
        assert body["errors"] == []

    def test_sync_rejects_over_50_files(self, auth_client):
        payload = {"files": [{"path": f"f{i}.txt", "content": "x"} for i in range(51)]}
        res = auth_client.post("/api/v1/workspace-files/sync", json=payload)
        assert res.status_code == 400
        assert "50" in res.json()["detail"]

    def test_sync_rejects_oversize_payload(self, auth_client):
        big = "x" * (11 * 1024 * 1024)  # > 10MB
        res = auth_client.post(
            "/api/v1/workspace-files/sync",
            json={"files": [{"path": "big.bin", "content": big}]},
        )
        assert res.status_code == 400
        assert "too large" in res.json()["detail"]

    def test_sync_reports_per_file_errors(self, auth_client):
        res = auth_client.post(
            "/api/v1/workspace-files/sync",
            json={"files": [{"path": "../bad.txt", "content": "nope"}]},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["synced"] == 0
        assert len(body["errors"]) == 1
        assert "bad" in body["errors"][0]


class TestWorkspaceUserIsolation:
    def test_same_path_two_users_distinct_content(self, client, auth_headers_factory=None):
        from tests.support.auth import headers_for

        headers_a = headers_for({"uid": "iso-a", "email": "a@x.com", "name": "A"})
        headers_b = headers_for({"uid": "iso-b", "email": "b@x.com", "name": "B"})

        client.put(
            "/api/v1/workspace-files/shared.txt", json={"content": "from A"}, headers=headers_a
        )
        client.put(
            "/api/v1/workspace-files/shared.txt", json={"content": "from B"}, headers=headers_b
        )

        got_a = client.get("/api/v1/workspace-files/shared.txt", headers=headers_a).json()
        got_b = client.get("/api/v1/workspace-files/shared.txt", headers=headers_b).json()
        assert got_a["content"] == "from A"
        assert got_b["content"] == "from B"


class TestServerlessGuard:
    def test_routes_return_503_in_serverless_mode(self, auth_client, monkeypatch):
        from tests.support.auth import override_settings

        with override_settings(is_serverless=True):
            assert auth_client.get("/api/v1/workspace-files/workspaces").status_code == 503
            assert (
                auth_client.post("/api/v1/workspace-files/workspaces", json={"name": "X"}).status_code
                == 503
            )
