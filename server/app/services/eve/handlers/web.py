"""Web browsing handlers — single responsibility: open web search and fetch."""

from app.db import SqlClient


def handle_browse_web(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.web_browsing import browse_web

    res = browse_web(
        query=arguments.get("query"),
        url=arguments.get("url"),
        num_results=arguments.get("num_results", 5),
        max_chars=arguments.get("max_chars", 12000),
    )
    return res, None, None


def handle_search_web(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.web_browsing import search_web

    res = search_web(
        query=arguments["query"],
        num_results=arguments.get("num_results", 5),
    )
    return res, None, None


def handle_fetch_web_page(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.web_browsing import fetch_web_page

    res = fetch_web_page(
        url=arguments["url"],
        max_chars=arguments.get("max_chars", 12000),
    )
    return res, None, None
