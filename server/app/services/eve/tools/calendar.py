"""Eve calendar tool definitions — single responsibility: calendar events and reminders."""

CALENDAR_TOOLS = [
    {
        "type": "function",
        "name": "create_calendar_event",
        "description": "Create a calendar event (meeting, deadline, or reminder) stored in the user's calendar_events collection.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "minLength": 1, "description": "Event title"},
                "date": {"type": "string", "description": "Event date in YYYY-MM-DD format"},
                "time": {"type": "string", "description": "Optional event time in HH:MM (24h) format"},
                "end_date": {"type": "string", "description": "Optional end date in YYYY-MM-DD format for multi-day events"},
                "notes": {"type": "string", "description": "Optional additional details"},
            },
            "required": ["title", "date"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "list_calendar_events",
        "description": "List the user's calendar events.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "delete_calendar_event",
        "description": "Delete a calendar event by its record id.",
        "parameters": {
            "type": "object",
            "properties": {
                "event_id": {"type": "string", "minLength": 1, "description": "Id of the calendar event to delete"},
            },
            "required": ["event_id"],
            "additionalProperties": False,
        },
        "strict": False,
    },
]
