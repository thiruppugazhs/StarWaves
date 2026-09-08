"""Shared constants for health sub-services — single source for table inventory and timing."""

import time

_START_TS = time.monotonic()

EXPECTED_TABLES = [
    "users",
    "jobs",
    "projects",
    "hackathons",
    "todos",
    "documents",
    "contacts",
    "notifications",
    "calls",
    "eve_sessions",
    "eve_memories",
    "eve_schedules",
    "user_settings",
    "workspace_files",
    "whatsapp_chats",
    "whatsapp_messages",
    "user_sessions",
    "ai_usage",
]


def elapsed_ms(t0: float) -> int:
    return int((time.monotonic() - t0) * 1000)
