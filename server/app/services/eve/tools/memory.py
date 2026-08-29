"""Eve memory tool definitions — single responsibility: memory domain."""

MEMORY_TOOLS = [
    {
        "type": "function",
        "name": "remember_memory",
        "description": "Save a fact or preference the user wants Eve to remember across conversations. Keep each memory concise (a short phrase or sentence).",
        "parameters": {
            "type": "object",
            "properties": {"content": {"type": "string", "minLength": 1, "maxLength": 500}},
            "required": ["content"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "recall_memories",
        "description": "Recall the user's saved memories. Optionally provide a query to search by keyword.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": [],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "forget_memory",
        "description": "Remove a previously saved memory using its id.",
        "parameters": {
            "type": "object",
            "properties": {"memory_id": {"type": "string", "minLength": 1}},
            "required": ["memory_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]
