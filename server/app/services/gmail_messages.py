"""Gmail message service — list, search, and send via the Gmail API for connected accounts.

Reuses the OAuth account documents stored by the Gmail integration routes and
refreshes access tokens when they are refreshable.
"""

import asyncio
import base64
import logging
from email.message import EmailMessage

import httpx

from app.core.config import settings
from app.services.oauth._shared import integration_accounts_reference
from app.services.oauth.google import decrypt_google_token, refresh_google_token

logger = logging.getLogger(__name__)

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
MAX_RESULTS_DEFAULT = 10
MAX_RESULTS_LIMIT = 25
SNIPPET_CHARS = 300

ACCOUNT_FIELDS = ("email", "access_token", "refresh_token", "refreshable")


class GmailServiceError(RuntimeError):
    """Raised when Gmail access is unavailable or an API call fails."""


def _load_accounts(database, user_id: str) -> list[dict]:
    docs = integration_accounts_reference(database, user_id, "gmail").stream()
    accounts = []
    for doc in docs:
        data = doc.to_dict() or {}
        if data.get("connected"):
            accounts.append({field: data.get(field) for field in ACCOUNT_FIELDS})
    return accounts


def _valid_access_token(account: dict) -> bool:
    """Probe the token; Gmail rejects expired ones with 401."""
    response = httpx.get(
        f"{GMAIL_API_BASE}/users/me/profile",
        headers={"Authorization": f"Bearer {account['access_token']}"},
        timeout=15,
    )
    return response.status_code != 401


def _refresh_access_token(account: dict) -> str:
    if not account.get("refreshable") or not account.get("refresh_token"):
        raise GmailServiceError(
            f"Gmail account {account.get('email')} has an expired token. Reconnect Gmail in Settings."
        )
    refresh_token = decrypt_google_token(account["refresh_token"])
    return asyncio.run(refresh_google_token(refresh_token))


def _resolve_access_token(database, user_id: str, account_email: str | None) -> tuple[dict, str]:
    accounts = _load_accounts(database, user_id)
    if not accounts:
        raise GmailServiceError("No Gmail account is connected. Connect Gmail in Settings first.")
    if account_email:
        accounts = [a for a in accounts if a["email"] == account_email]
        if not accounts:
            raise GmailServiceError(f"Gmail account {account_email} is not connected.")
    account = accounts[0]
    token = account.get("access_token")
    if not token or not _valid_access_token(account):
        token = _refresh_access_token(account)
    return account, token


def _api_get(token: str, path: str, params: dict) -> dict:
    response = httpx.get(
        f"{GMAIL_API_BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        params=params,
        timeout=30,
    )
    if response.status_code == 401:
        raise GmailServiceError("Gmail access token expired. Reconnect Gmail in Settings.")
    response.raise_for_status()
    return response.json()


def _summarize_message(token: str, message_id: str) -> dict:
    payload = _api_get(token, f"/users/me/messages/{message_id}", {"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]})
    headers = {h["name"]: h["value"] for h in payload.get("payload", {}).get("headers", [])}
    return {
        "id": payload["id"],
        "subject": headers.get("Subject", "(no subject)"),
        "from": headers.get("From", ""),
        "date": headers.get("Date", ""),
        "snippet": payload.get("snippet", "")[:SNIPPET_CHARS],
    }


def list_messages(database, user_id: str, query: str = "", max_results: int = MAX_RESULTS_DEFAULT, account_email: str | None = None) -> dict:
    """List (optionally query-filtered) Gmail messages, newest first."""
    account, token = _resolve_access_token(database, user_id, account_email)
    max_results = min(max(1, max_results), MAX_RESULTS_LIMIT)
    params = {"maxResults": max_results}
    if query:
        params["q"] = query
    payload = _api_get(token, "/users/me/messages", params)
    messages = [_summarize_message(token, item["id"]) for item in payload.get("messages", [])]
    return {"account": account["email"], "query": query, "messages": messages, "total": len(messages)}


def send_message(database, user_id: str, to_email: str, subject: str, body_text: str, account_email: str | None = None) -> dict:
    """Send an email from the connected Gmail account."""
    account, token = _resolve_access_token(database, user_id, account_email)
    message = EmailMessage()
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body_text)
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")
    response = httpx.post(
        f"{GMAIL_API_BASE}/users/me/messages/send",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"raw": raw},
        timeout=30,
    )
    if response.status_code == 401:
        raise GmailServiceError("Gmail access token expired. Reconnect Gmail in Settings.")
    response.raise_for_status()
    return {"sent": True, "to": to_email, "subject": subject, "from": account["email"]}
