"""Email handlers — single responsibility: Gmail message operations."""

from app.db import SqlClient


def handle_send_email(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.gmail_messages import send_message

    return send_message(
        database,
        user_id,
        arguments["to"],
        arguments.get("subject", ""),
        arguments["body"],
        arguments.get("from_account"),
    ), None, None


def handle_list_emails(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.gmail_messages import list_messages

    return list_messages(
        database,
        user_id,
        query="",
        max_results=arguments.get("max_results", 10),
        account_email=arguments.get("account"),
    ), None, None


def handle_search_emails(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    from app.services.gmail_messages import list_messages

    return list_messages(
        database,
        user_id,
        query=arguments["query"],
        max_results=arguments.get("max_results", 10),
        account_email=arguments.get("account"),
    ), None, None
