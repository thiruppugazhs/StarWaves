"""Eve search tool definitions — single responsibility: search domain."""

from app.services.eve.constants import SUPPORTED_RESOURCES

SEARCH_TOOLS = [
    {
        "type": "function",
        "name": "search_workspace",
        "description": "Search across local StarWaves workspace records.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "minLength": 1},
                "resources": {
                    "type": "array",
                    "items": {"type": "string", "enum": list(SUPPORTED_RESOURCES)},
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "workspace_insight",
        "description": "Generate computed workspace insights such as dashboard summary, deadlines, overdue tasks, stale projects, next actions, export summary, or calendar day.",
        "parameters": {
            "type": "object",
            "properties": {
                "kind": {
                    "type": "string",
                    "enum": [
                        "summarize_dashboard",
                        "summarize_upcoming_deadlines",
                        "find_overdue_tasks",
                        "find_stale_projects",
                        "suggest_next_actions",
                        "export_workspace_summary",
                        "summarize_calendar_day",
                        "filter_calendar_events",
                    ],
                },
                "date": {"type": "string"},
                "query": {"type": "string"},
            },
            "required": ["kind"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "explain_record",
        "description": "Explain a specific workspace record.",
        "parameters": {
            "type": "object",
            "properties": {
                "resource": {"type": "string", "enum": list(SUPPORTED_RESOURCES)},
                "record_id": {"type": "string", "minLength": 1},
            },
            "required": ["resource", "record_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "generate_text_artifact",
        "description": "Generate a non-sending draft or plan from workspace context.",
        "parameters": {
            "type": "object",
            "properties": {
                "kind": {
                    "type": "string",
                    "enum": ["generate_project_plan", "generate_job_followup_note", "draft_email", "draft_chat_message", "generate_document_summary"],
                },
                "resource": {"type": "string", "enum": list(SUPPORTED_RESOURCES)},
                "record_id": {"type": "string"},
                "prompt": {"type": "string"},
            },
            "required": ["kind"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
