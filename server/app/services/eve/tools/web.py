"""Eve web tool definitions — single responsibility: web domain."""

WEB_TOOLS = [
    {
        "type": "function",
        "name": "browse_web",
        "description": "Browse the web. Search the open web using a search query, fetch and read the content of a specific web URL, or do both.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Optional search query to search the open web for"},
                "url": {"type": "string", "description": "Optional HTTP or HTTPS URL to fetch and read"},
                "num_results": {"type": "integer", "description": "Number of search results to return (default 5, max 10)"},
                "max_chars": {"type": "integer", "description": "Maximum characters of text to extract from the page (default 12000)"},
            },
            "required": [],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "search_web",
        "description": "Search the open web for current information, documentation, news, or articles. Returns top matching results with titles, snippets, and URLs.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "minLength": 1, "description": "The search terms to query the web for"},
                "num_results": {"type": "integer", "description": "Number of search results to return (default 5, max 10)"},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "fetch_web_page",
        "description": "Fetch and extract readable text/markdown content from an external web URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "minLength": 1, "description": "The HTTP or HTTPS URL of the web page to read"},
                "max_chars": {"type": "integer", "description": "Maximum characters of text content to extract (default 12000, max 30000)"},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
