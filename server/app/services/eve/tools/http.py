"""Eve HTTP tool definitions — single responsibility: arbitrary API requests."""

HTTP_TOOLS = [
    {
        "type": "function",
        "name": "http_request",
        "description": "Make an HTTP request to any external API endpoint. Supports GET, POST, PUT, PATCH, and DELETE with JSON bodies. Requests to localhost and private networks are blocked.",
        "parameters": {
            "type": "object",
            "properties": {
                "method": {"type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"], "description": "HTTP method (default GET)"},
                "url": {"type": "string", "minLength": 1, "description": "The HTTP or HTTPS URL to request"},
                "body": {"type": "object", "description": "Optional JSON body for the request"},
                "headers": {"type": "object", "description": "Optional extra request headers"},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
