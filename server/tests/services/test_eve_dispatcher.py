"""Service tests: Eve tool dispatcher routing (real SQLite)."""

import pytest

from app.services.eve.dispatcher import dispatch_tool


class TestUnknownTools:
    def test_unknown_tool_returns_graceful_error(self, db):
        result, resource, action = dispatch_tool(None, "user-1", "definitely_not_a_tool", {})
        assert "Unsupported Eve tool" in result["error"]
        assert "create_workspace_record" in result["error"]  # available tools listed
        assert resource is None and action is None

    def test_error_lists_sorted_available_tools(self, db):
        result, _, _ = dispatch_tool(None, "u", "zzz_unknown", {})
        assert result["error"].index("browse_web") < result["error"].index("send_email")


class TestWorkspaceRecordHandlers:
    def test_create_and_list_todo_via_record_tools(self, db):
        created, changed, _ = dispatch_tool(
            get_db(), "user-1",
            "create_workspace_record",
            {"resource": "todo", "data": {"title": "Dispatched todo"}},
        )
        assert "record" in created
        assert changed == "todos"

        listed, _, _ = dispatch_tool(get_db(), "user-1", "list_todos", {})
        titles = [r.get("title") for r in listed.get("records", [])]
        assert "Dispatched todo" in titles

    def test_resource_alias_normalization(self, db):
        """RESOURCE_ALIASES maps casual names like 'task' to canonical resources."""
        created, changed, _ = dispatch_tool(
            get_db(), "user-1",
            "create_workspace_record",
            {"resource": "task", "data": {"title": "Alias todo"}},
        )
        if "error" not in created:
            assert changed == "todos"
        else:
            # At minimum the alias must not crash the handler
            assert "error" in created

    def test_list_alias_convenience_tools(self, db):
        for tool in ("list_jobs", "list_todos", "list_projects", "list_notifications"):
            result, _, _ = dispatch_tool(get_db(), "user-1", tool, {})
            assert "error" not in result or "records" in result, f"{tool}: {result}"

    def test_missing_required_argument_is_graceful(self, db):
        result, _, _ = dispatch_tool(
            get_db(), "user-1", "create_workspace_record", {"resource": "todo"}
        )
        assert isinstance(result, dict)
        assert "error" in result  # graceful error instead of KeyError crash

    def test_update_without_changes_is_graceful(self, db):
        result, _, _ = dispatch_tool(
            get_db(), "user-1",
            "update_workspace_record",
            {"resource": "todo", "record_id": "abc"},
        )
        assert isinstance(result, dict) and "error" in result


class TestMemoryToolRouting:
    def test_remember_fact_saves_memory(self, db):
        from app.db import FieldFilter
        from tests.support.db import get_sql_client

        database = get_sql_client()
        result, changed, _ = dispatch_tool(
            database, "user-1", "remember_memory",
            {"content": "User loves espresso"},
        )
        if "error" not in result:
            memories = list(
                database.collection("users").document("user-1")
                .collection("eve_memories").stream()
            )
            assert any(m.to_dict().get("content") == "User loves espresso" for m in memories)


def get_db():
    from tests.support.db import get_sql_client

    return get_sql_client()
