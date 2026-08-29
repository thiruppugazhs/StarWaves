"""Studio project service tests — metadata, templates, plans, preview tokens."""

import os
import shutil
import tempfile
import unittest

from app.core.config import settings
from app.repositories import studio as studio_repo
from app.services.studio import git_ops, preview as studio_preview
from app.services.studio.projects import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    save_plan,
    set_plan_status,
    write_batch_files,
)
from app.services.studio.templates import list_curated_templates

USER = "studio-test-user"


class TestStudioProjects(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        object.__setattr__(settings, "workspace_storage_path", self.temp_dir)

    def tearDown(self):
        object.__setattr__(settings, "workspace_storage_path", "workspaces")
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create(self, name="My App", template_id=None):
        from app.schemas.studio import StudioProjectCreateRequest

        return create_project(
            USER,
            StudioProjectCreateRequest(
                name=name,
                template_id=template_id,
                db_preference="sqlite",
            ),
        )

    def test_create_and_list_project(self):
        project = self._create("Habit Tracker")
        self.assertEqual(project["type"], "studio")
        self.assertEqual(project["db_preference"], "sqlite")
        projects = list_projects(USER)
        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0]["name"], "Habit Tracker")

    def test_regular_workspaces_not_listed_as_studio(self):
        from app.repositories import workspace_files as ws_repo

        ws_repo.create_workspace(USER, "Plain Workspace")
        self._create("Real Project")
        names = [p["name"] for p in list_projects(USER)]
        self.assertEqual(names, ["Real Project"])

    def test_template_scaffold_populates_files(self):
        project = self._create("Vite App", template_id="react-vite")
        self.assertGreater(project["file_count"], 0)
        detail = get_project(USER, project["id"])
        self.assertTrue(detail["git"]["initialized"] or not git_ops.is_available())

    def test_unknown_template_rejected(self):
        with self.assertRaises(ValueError):
            self._create("Bad", template_id="does-not-exist")

    def test_plan_flow(self):
        project = self._create("Planned App")
        plan = save_plan(
            USER,
            project["id"],
            {
                "title": "Habit tracker",
                "summary": "Track daily habits",
                "stack": "react-vite",
                "db_preference": "sqlite",
                "needs_auth": True,
                "files": [{"path": "src/App.jsx", "purpose": "root"}],
            },
        )
        self.assertEqual(plan["plan_status"], "proposed")
        approved = set_plan_status(USER, project["id"], "approved")
        self.assertEqual(approved["plan_status"], "approved")

    def test_write_batch_files_updates_status(self):
        project = self._create("Writer")
        save_plan(
            USER,
            project["id"],
            {"title": "T", "files": [{"path": "a.txt"}]},
        )
        set_plan_status(USER, project["id"], "approved")
        result = write_batch_files(
            USER,
            project["id"],
            [{"path": "src/index.js", "content": "console.log(1)"}],
        )
        self.assertEqual(result["written"], 1)
        refreshed = get_project(USER, project["id"])
        self.assertEqual(refreshed["build_status"], "building")

    def test_delete_project(self):
        project = self._create("Doomed")
        self.assertTrue(delete_project(USER, project["id"]))
        self.assertFalse(delete_project(USER, project["id"]))
        self.assertEqual(list_projects(USER), [])

    def test_preview_token_roundtrip(self):
        project = self._create("Preview App")
        url_info = studio_preview.build_preview_url(USER, project["id"])
        user_id, workspace_id = studio_preview.resolve_preview_token(url_info["token"])
        self.assertEqual(user_id, USER)
        self.assertEqual(workspace_id, project["id"])

    def test_curated_templates_catalog(self):
        templates = list_curated_templates()
        ids = {t["id"] for t in templates}
        self.assertIn("react-vite", ids)
        self.assertIn("fullstack-react-fastapi", ids)


if __name__ == "__main__":
    unittest.main()
