"""HTTP handler — single responsibility: arbitrary outbound HTTP requests."""

from app.db import SqlClient


def handle_http_request(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.http_requests import perform_request

    result = perform_request(
        arguments.get("method", "GET"),
        arguments["url"],
        arguments.get("body"),
        arguments.get("headers"),
    )
    return result, None, None
