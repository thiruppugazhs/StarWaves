"""Eve navigation tool definitions — single responsibility: navigation domain."""

from app.services.eve.constants import WORKSPACE_PAGES

NAVIGATION_TOOLS = [
    {
        "type": "function",
        "name": "navigate_page",
        "description": "Navigate the user to a StarWaves workspace page.",
        "parameters": {
            "type": "object",
            "properties": {"page": {"type": "string", "enum": list(WORKSPACE_PAGES)}},
            "required": ["page"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "open_record",
        "description": "Open a record detail view when supported. Supports projects and documents.",
        "parameters": {
            "type": "object",
            "properties": {
                "resource": {"type": "string", "enum": ["projects", "documents"]},
                "record_id": {"type": "string", "minLength": 1},
            },
            "required": ["resource", "record_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "refresh_workspace_data",
        "description": "Refresh StarWaves workspace data in the frontend.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        "strict": True,
    },
]
