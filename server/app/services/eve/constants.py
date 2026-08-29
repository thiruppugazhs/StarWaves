"""Eve service constants — single responsibility: workspace limits and enumerations."""

MAX_RECORDS_PER_READ = 50
SUPPORTED_RESOURCES = ("todos", "projects", "jobs", "hackathons", "documents", "notifications", "calendar_events")
WRITABLE_RESOURCES = ("todos", "projects", "jobs", "hackathons", "documents", "calendar_events")
WORKSPACE_PAGES = (
    "dashboard",
    "stats",
    "todo",
    "calendar",
    "mails",
    "chats",
    "competitive-coding",
    "hackathons",
    "projects",
    "jobs",
    "documents",
    "workspace",
    "studio",
    "studio-apps",
    "studio-templates",
    "whatsapp",
    "profile",
    "setting",
)
