"""Browser-control handlers — single responsibility: headless browser session actions."""

from app.db import SqlClient


def handle_browser_navigate(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.browser_automation import browser_navigate

    return browser_navigate(user_id, arguments["url"]), None, None


def handle_browser_click(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.browser_automation import browser_click

    return browser_click(user_id, arguments["selector"]), None, None


def handle_browser_type(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.browser_automation import browser_type

    return browser_type(user_id, arguments["selector"], arguments["text"], arguments.get("submit", False)), None, None


def handle_browser_extract_text(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.browser_automation import browser_extract_text

    return browser_extract_text(user_id, arguments.get("selector")), None, None


def handle_browser_screenshot(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, None]:
    from app.services.browser_automation import browser_screenshot
    from app.services.eve.handlers.artifacts import save_media_file

    data = browser_screenshot(user_id, arguments.get("full_page", False))
    path = save_media_file(user_id, "screenshot", "png", data)
    return {"path": path, "bytes": len(data)}, "workspace-files", None
