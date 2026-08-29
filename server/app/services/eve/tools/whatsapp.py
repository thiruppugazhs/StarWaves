"""Eve whatsapp tool definitions — single responsibility: whatsapp domain."""

WHATSAPP_TOOLS = [
    {
        "type": "function",
        "name": "list_whatsapp_chats",
        "description": "List the user's recent WhatsApp conversations, active contacts, unread counts, and last messages.",
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "read_whatsapp_messages",
        "description": "Read recent WhatsApp message history for a specific chat or contact.",
        "parameters": {
            "type": "object",
            "properties": {
                "chat_id": {"type": "string", "description": "The chat ID, phone number, or 'eve' to read messages from"},
                "limit": {"type": "integer", "description": "Number of recent messages to fetch (default 20, max 50)"},
            },
            "required": ["chat_id"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "send_whatsapp_message",
        "description": "Send a WhatsApp message to a specific contact or phone number on behalf of the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "chat_id": {"type": "string", "description": "The contact JID or phone number (e.g. +1234567890 or 1234567890@s.whatsapp.net)"},
                "content": {"type": "string", "description": "The message text to send"},
            },
            "required": ["chat_id", "content"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "summarize_whatsapp_chat",
        "description": "Generate a concise summary and action points for a WhatsApp chat.",
        "parameters": {
            "type": "object",
            "properties": {
                "chat_id": {"type": "string", "description": "The chat ID to summarize"},
            },
            "required": ["chat_id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]
