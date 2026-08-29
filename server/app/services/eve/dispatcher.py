"""Eve dispatcher — single responsibility: routing tool calls to domain handlers."""

from typing import Any

from app.db import SqlClient

from app.services.eve.handlers.call import handle_make_twilio_call, handle_trigger_eve_call
from app.services.eve.handlers.calendar import (
    handle_create_calendar_event,
    handle_delete_calendar_event,
    handle_list_calendar_events,
)
from app.services.eve.handlers.memory import (
    handle_forget_memory,
    handle_recall_memories,
    handle_remember_memory,
)
from app.services.eve.handlers.navigation import (
    handle_navigate_page,
    handle_open_record,
    handle_open_studio_project,
    handle_refresh_workspace_data,
)
from app.services.eve.handlers.schedule import (
    handle_create_eve_schedule,
    handle_delete_eve_schedule,
    handle_list_eve_schedules,
)
from app.services.eve.handlers.browser import (
    handle_browser_click,
    handle_browser_extract_text,
    handle_browser_navigate,
    handle_browser_screenshot,
    handle_browser_type,
)
from app.services.eve.handlers.email import (
    handle_list_emails,
    handle_search_emails,
    handle_send_email,
)
from app.services.eve.handlers.http import handle_http_request
from app.services.eve.handlers.media import (
    handle_generate_image,
    handle_generate_video,
    handle_speech_to_text,
    handle_text_to_speech,
)
from app.services.eve.handlers.ui import (
    handle_create_custom_page,
    handle_get_ui_state,
    handle_list_ui_history,
    handle_manage_ui_visibility,
    handle_reset_ui,
    handle_update_ui_styles,
    handle_update_ui_theme,
)
from app.services.eve.handlers.studio import (
    handle_create_studio_project,
    handle_get_studio_project,
    handle_list_studio_projects,
    handle_publish_studio_template,
    handle_run_studio_command,
    handle_submit_build_plan,
    handle_write_studio_files,
)
from app.services.eve.handlers.web import (
    handle_browse_web,
    handle_fetch_web_page,
    handle_search_web,
)
from app.services.eve.handlers.whatsapp import (
    handle_list_whatsapp_chats,
    handle_read_whatsapp_messages,
    handle_send_whatsapp_message,
    handle_summarize_whatsapp_chat,
)
from app.services.eve.handlers.workspace import (
    handle_bulk_update_records,
    handle_create_workspace_record,
    handle_delete_workspace_record,
    handle_explain_record,
    handle_generate_text_artifact,
    handle_list_workspace_records,
    handle_restore_workspace_record,
    handle_search_workspace,
    handle_update_workspace_record,
    handle_workspace_insight,
)
from app.services.eve.handlers.utility import (
    handle_create_chart,
    handle_extract_text_from_image,
    handle_generate_qr_code,
    handle_read_pdf_file,
)
from app.services.eve.handlers.workspace_files import (
    handle_list_workspace_files,
    handle_open_workspace_browser,
    handle_read_workspace_file,
    handle_run_workspace_command,
    handle_search_workspace_files,
    handle_write_workspace_file,
)

def _make_list_alias(resource: str):
    def _handler(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
        args = dict(arguments or {})
        args["resource"] = resource
        return handle_list_workspace_records(database, user_id, args)
    return _handler


# Registry maps tool name to its dedicated handler — one function per tool avoids mode-flag branching.
_TOOL_HANDLERS: dict[str, Any] = {
    "remember_memory": handle_remember_memory,
    "recall_memories": handle_recall_memories,
    "forget_memory": handle_forget_memory,
    "create_eve_schedule": handle_create_eve_schedule,
    "list_eve_schedules": handle_list_eve_schedules,
    "delete_eve_schedule": handle_delete_eve_schedule,
    "trigger_eve_call": handle_trigger_eve_call,
    "make_twilio_call": handle_make_twilio_call,
    "read_workspace_file": handle_read_workspace_file,
    "write_workspace_file": handle_write_workspace_file,
    "list_workspace_files": handle_list_workspace_files,
    "search_workspace_files": handle_search_workspace_files,
    "run_workspace_command": handle_run_workspace_command,
    "open_workspace_browser": handle_open_workspace_browser,
    "list_whatsapp_chats": handle_list_whatsapp_chats,
    "read_whatsapp_messages": handle_read_whatsapp_messages,
    "send_whatsapp_message": handle_send_whatsapp_message,
    "summarize_whatsapp_chat": handle_summarize_whatsapp_chat,
    "navigate_page": handle_navigate_page,
    "open_record": handle_open_record,
    "open_studio_project": handle_open_studio_project,
    "refresh_workspace_data": handle_refresh_workspace_data,
    "search_workspace": handle_search_workspace,
    "workspace_insight": handle_workspace_insight,
    "explain_record": handle_explain_record,
    "generate_text_artifact": handle_generate_text_artifact,
    "bulk_update_records": handle_bulk_update_records,
    "delete_workspace_record": handle_delete_workspace_record,
    "restore_workspace_record": handle_restore_workspace_record,
    "list_workspace_records": handle_list_workspace_records,
    "create_workspace_record": handle_create_workspace_record,
    "update_workspace_record": handle_update_workspace_record,
    # Resource convenience aliases
    "list_jobs": _make_list_alias("jobs"),
    "list_todos": _make_list_alias("todos"),
    "list_tasks": _make_list_alias("todos"),
    "list_projects": _make_list_alias("projects"),
    "list_documents": _make_list_alias("documents"),
    "list_hackathons": _make_list_alias("hackathons"),
    "list_notifications": _make_list_alias("notifications"),
    "browse_web": handle_browse_web,
    "search_web": handle_search_web,
    "web_search": handle_search_web,
    "fetch_web_page": handle_fetch_web_page,
    "read_web_page": handle_fetch_web_page,
    "create_studio_project": handle_create_studio_project,
    "list_studio_projects": handle_list_studio_projects,
    "get_studio_project": handle_get_studio_project,
    "submit_build_plan": handle_submit_build_plan,
    "write_studio_files": handle_write_studio_files,
    "run_studio_command": handle_run_studio_command,
    "publish_studio_template": handle_publish_studio_template,
    "generate_image": handle_generate_image,
    "generate_video": handle_generate_video,
    "text_to_speech": handle_text_to_speech,
    "speech_to_text": handle_speech_to_text,
    "browser_navigate": handle_browser_navigate,
    "browser_click": handle_browser_click,
    "browser_type": handle_browser_type,
    "browser_extract_text": handle_browser_extract_text,
    "browser_screenshot": handle_browser_screenshot,
    "generate_qr_code": handle_generate_qr_code,
    "create_chart": handle_create_chart,
    "read_pdf_file": handle_read_pdf_file,
    "extract_text_from_image": handle_extract_text_from_image,
    "send_email": handle_send_email,
    "list_emails": handle_list_emails,
    "search_emails": handle_search_emails,
    "create_calendar_event": handle_create_calendar_event,
    "list_calendar_events": handle_list_calendar_events,
    "delete_calendar_event": handle_delete_calendar_event,
    "http_request": handle_http_request,
    "get_ui_state": handle_get_ui_state,
    "update_ui_theme": handle_update_ui_theme,
    "update_ui_styles": handle_update_ui_styles,
    "manage_ui_visibility": handle_manage_ui_visibility,
    "reset_ui": handle_reset_ui,
    "list_ui_history": handle_list_ui_history,
    "create_custom_page": handle_create_custom_page,
}


def dispatch_tool(
    database: SqlClient, user_id: str, name: str, arguments: dict[str, Any]
) -> tuple[dict[str, Any], str | None, dict[str, Any] | None]:
    """Route a tool call to its single-responsibility handler."""
    handler = _TOOL_HANDLERS.get(name)
    if handler:
        return handler(database, user_id, arguments)
    return {
        "error": f"Unsupported Eve tool '{name}'. Available tools: {', '.join(sorted(_TOOL_HANDLERS.keys()))}."
    }, None, None

