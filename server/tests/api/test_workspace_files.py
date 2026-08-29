import os
import shutil
import tempfile
import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.core.config import settings
from app.db import get_firestore

mock_user = {"uid": "test-user-ws", "email": "ws@example.com"}
mock_db = MagicMock()


class TestMultiWorkspace(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_firestore] = lambda: mock_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_firestore, None)

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        object.__setattr__(settings, "workspace_storage_path", self.temp_dir)

    def tearDown(self):
        object.__setattr__(settings, "workspace_storage_path", "workspaces")
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_workspaces_crud_and_isolation(self):
        # 1. List initial workspaces - default is created
        res = self.client.get("/api/v1/workspace-files/workspaces")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["workspaces"]), 1)
        self.assertEqual(data["workspaces"][0]["id"], "default")

        # 2. Create new workspace
        res = self.client.post("/api/v1/workspace-files/workspaces", json={"name": "Project Alpha"})
        self.assertEqual(res.status_code, 201)
        alpha = res.json()
        self.assertEqual(alpha["name"], "Project Alpha")
        alpha_id = alpha["id"]

        # 3. Create second workspace
        res = self.client.post("/api/v1/workspace-files/workspaces", json={"name": "Project Beta"})
        self.assertEqual(res.status_code, 201)
        beta_id = res.json()["id"]

        # 4. Write file in Alpha
        res = self.client.put(f"/api/v1/workspace-files/main.py?workspace_id={alpha_id}", json={"content": "print('alpha')"})
        self.assertEqual(res.status_code, 200)

        # 5. Write file in Beta
        res = self.client.put(f"/api/v1/workspace-files/index.js?workspace_id={beta_id}", json={"content": "console.log('beta')"})
        self.assertEqual(res.status_code, 200)

        # 6. Verify isolation in file trees
        tree_alpha = self.client.get(f"/api/v1/workspace-files/tree?workspace_id={alpha_id}").json()
        paths_alpha = [f["path"] for f in tree_alpha["files"]]
        self.assertIn("main.py", paths_alpha)
        self.assertNotIn("index.js", paths_alpha)

        tree_beta = self.client.get(f"/api/v1/workspace-files/tree?workspace_id={beta_id}").json()
        paths_beta = [f["path"] for f in tree_beta["files"]]
        self.assertIn("index.js", paths_beta)
        self.assertNotIn("main.py", paths_beta)

        # 7. Read file content
        res = self.client.get(f"/api/v1/workspace-files/main.py?workspace_id={alpha_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["content"], "print('alpha')")

        # 8. Rename Alpha
        res = self.client.patch(f"/api/v1/workspace-files/workspaces/{alpha_id}", json={"name": "Project Alpha Renamed"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["name"], "Project Alpha Renamed")

        # 9. Delete Alpha
        res = self.client.delete(f"/api/v1/workspace-files/workspaces/{alpha_id}")
        self.assertEqual(res.status_code, 204)

        # Verify Alpha is gone
        list_res = self.client.get("/api/v1/workspace-files/workspaces").json()
        ws_ids = [ws["id"] for ws in list_res["workspaces"]]
        self.assertNotIn(alpha_id, ws_ids)
        self.assertIn(beta_id, ws_ids)


if __name__ == "__main__":
    unittest.main()
