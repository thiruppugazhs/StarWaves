from types import SimpleNamespace

from app.repositories import modeling_projects


def test_modeling_project_versions_and_assets_are_isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(modeling_projects, "settings", SimpleNamespace(workspace_storage_path=str(tmp_path), modeling_asset_max_bytes=128))

    created = modeling_projects.create_project("user-a", "Character scene", "default")
    version = modeling_projects.save_version(
        "user-a",
        created["id"],
        {"schemaVersion": 1, "nodes": [{"id": "root"}]},
        "Initial scene",
    )
    asset = modeling_projects.save_asset(
        "user-a",
        created["id"],
        "character.glb",
        b"glTF",
        "model/gltf-binary",
    )

    loaded = modeling_projects.get_project("user-a", created["id"])
    assert loaded["current_version_id"] == version["id"]
    assert loaded["scene"]["nodes"][0]["id"] == "root"
    assert loaded["assets"][0]["id"] == asset["id"]
    assert modeling_projects.get_asset_path("user-a", created["id"], asset["id"])[0].is_file()

    try:
        modeling_projects.get_project("user-b", created["id"])
    except FileNotFoundError:
        pass
    else:
        raise AssertionError("A project must not be readable across users.")


def test_modeling_asset_validation_rejects_unsupported_or_large_files(tmp_path, monkeypatch):
    monkeypatch.setattr(modeling_projects, "settings", SimpleNamespace(workspace_storage_path=str(tmp_path), modeling_asset_max_bytes=4))
    project = modeling_projects.create_project("user-a", "Validation", "default")

    try:
        modeling_projects.save_asset("user-a", project["id"], "notes.txt", b"ok", "text/plain")
    except ValueError as error:
        assert "Unsupported" in str(error)
    else:
        raise AssertionError("Unsupported asset types must be rejected.")

    try:
        modeling_projects.save_asset("user-a", project["id"], "large.glb", b"12345", "model/gltf-binary")
    except ValueError as error:
        assert "size limit" in str(error)
    else:
        raise AssertionError("Oversized assets must be rejected.")
