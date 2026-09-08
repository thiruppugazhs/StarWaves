"""Eve tools for validated Avatar Studio editor actions."""

AVATAR_EDITOR_TOOLS = [
    {
        "type": "function",
        "name": "avatar_editor_action",
        "description": (
            "Request a validated action in the open Avatar Studio editor. "
            "The frontend applies the action and asks for confirmation when required."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "enum": ["select_node", "update_transform", "set_material", "add_keyframe", "save", "playback", "export_glb"],
                },
                "node_id": {"type": ["string", "null"]},
                "node_name": {"type": ["string", "null"]},
                "position": {"type": ["array", "null"], "items": {"type": "number"}},
                "rotation": {"type": ["array", "null"], "items": {"type": "number"}},
                "scale": {"type": ["array", "null"], "items": {"type": "number"}},
                "color": {"type": ["string", "null"]},
                "frame": {"type": ["integer", "null"], "minimum": 0},
                "playing": {"type": ["boolean", "null"]},
            },
            "required": ["command", "node_id", "node_name", "position", "rotation", "scale", "color", "frame", "playing"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]
