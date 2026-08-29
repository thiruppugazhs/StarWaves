"""Eve email tool definitions — single responsibility: reading and sending email."""

EMAIL_TOOLS = [
    {
        "type": "function",
        "name": "send_email",
        "description": "Send an email from the user's connected Gmail account.",
        "parameters": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "minLength": 3, "description": "Recipient email address"},
                "subject": {"type": "string", "description": "Email subject line"},
                "body": {"type": "string", "minLength": 1, "description": "Plain-text email body"},
                "from_account": {"type": "string", "description": "Optional connected Gmail address to send from (defaults to the first connected account)"},
            },
            "required": ["to", "subject", "body"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "list_emails",
        "description": "List recent emails from the user's connected Gmail account, newest first.",
        "parameters": {
            "type": "object",
            "properties": {
                "max_results": {"type": "integer", "description": "Number of emails to return (default 10, max 25)"},
                "account": {"type": "string", "description": "Optional connected Gmail address to read from"},
            },
            "required": [],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "search_emails",
        "description": "Search the user's connected Gmail account with Gmail search syntax (from:, subject:, has:attachment, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "minLength": 1, "description": "Gmail search query, e.g. 'from:alice@example.com invoice'"},
                "max_results": {"type": "integer", "description": "Number of results to return (default 10, max 25)"},
                "account": {"type": "string", "description": "Optional connected Gmail address to search"},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
