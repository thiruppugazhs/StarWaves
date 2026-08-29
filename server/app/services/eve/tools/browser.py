"""Eve browser-control tool definitions — single responsibility: interactive web automation."""

BROWSER_TOOLS = [
    {
        "type": "function",
        "name": "browser_navigate",
        "description": "Open a URL in Eve's headless browser session. The page state persists across browser_* tool calls, so you can navigate then click, type, extract, or screenshot.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "minLength": 1, "description": "The HTTP or HTTPS URL to open"},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "browser_click",
        "description": "Click an element in Eve's headless browser session using a CSS selector.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "minLength": 1, "description": "CSS selector of the element to click"},
            },
            "required": ["selector"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "browser_type",
        "description": "Type text into a form field in Eve's headless browser session using a CSS selector.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "minLength": 1, "description": "CSS selector of the input field"},
                "text": {"type": "string", "description": "Text to type into the field"},
                "submit": {"type": "boolean", "description": "Press Enter after typing to submit the form (default false)"},
            },
            "required": ["selector", "text"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "browser_extract_text",
        "description": "Extract visible text from the current page in Eve's headless browser session, optionally scoped to a CSS selector.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "Optional CSS selector to extract text from; defaults to the whole page"},
            },
            "required": [],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "browser_screenshot",
        "description": "Capture a PNG screenshot of the current page in Eve's headless browser session and save it to the workspace.",
        "parameters": {
            "type": "object",
            "properties": {
                "full_page": {"type": "boolean", "description": "Capture the full scrollable page instead of the viewport (default false)"},
            },
            "required": [],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
