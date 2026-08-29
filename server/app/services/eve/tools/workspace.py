"""Eve workspace tool definitions — single responsibility: workspace domain."""

from app.services.eve.constants import SUPPORTED_RESOURCES, WRITABLE_RESOURCES

WORKSPACE_TOOLS = [
    {
        "type": "function",
        "name": "list_workspace_records",
        "description": "List the current user's records for a supported workspace resource.",
        "parameters": {
            "type": "object",
            "properties": {"resource": {"type": "string", "enum": list(SUPPORTED_RESOURCES)}},
            "required": ["resource"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_workspace_record",
        "description": "Create a record for the current user. data must use the API field names for the selected resource.",
        "parameters": {
            "type": "object",
            "properties": {
                "resource": {"type": "string", "enum": list(WRITABLE_RESOURCES)},
                "data": {"type": "object", "additionalProperties": True},
            },
            "required": ["resource", "data"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "update_workspace_record",
        "description": "Update one existing record owned by the current user. changes must use the API field names for the selected resource.",
        "parameters": {
            "type": "object",
            "properties": {
                "resource": {"type": "string", "enum": list(SUPPORTED_RESOURCES)},
                "record_id": {"type": "string", "minLength": 1},
                "changes": {"type": "object", "additionalProperties": True},
            },
            "required": ["resource", "record_id", "changes"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "delete_workspace_record",
        "description": "Soft delete a workspace record owned by the current user. The record remains recoverable for 7 days before permanent deletion.",
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
        "name": "restore_workspace_record",
        "description": "Restore a soft-deleted workspace record owned by the current user within the 7-day retention period.",
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
        "name": "bulk_update_records",
        "description": "Update several records of the same resource. Use only after the user clearly specifies the changes.",
        "parameters": {
            "type": "object",
            "properties": {
                "resource": {"type": "string", "enum": ["todos", "projects", "jobs", "hackathons", "notifications"]},
                "updates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "record_id": {"type": "string", "minLength": 1},
                            "changes": {"type": "object", "additionalProperties": True},
                        },
                        "required": ["record_id", "changes"],
                        "additionalProperties": False,
                    },
                    "minItems": 1,
                    "maxItems": 20,
                },
            },
            "required": ["resource", "updates"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
