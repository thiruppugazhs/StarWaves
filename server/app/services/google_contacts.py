"""Google Contacts (People API) service helpers."""

import logging
from typing import Any

import httpx

from app.services.oauth import google_oauth_state_serializer

logger = logging.getLogger(__name__)

GOOGLE_CONTACTS_SCOPES = (
    "openid email profile "
    "https://www.googleapis.com/auth/contacts.readonly"
)


def google_contacts_state_serializer():
    return google_oauth_state_serializer("starwaves-google-contacts-oauth-state")


def parse_google_person(person: dict[str, Any]) -> dict[str, Any] | None:
    names = person.get("names") or []
    primary_name = next((n for n in names if n.get("metadata", {}).get("primary")), None) or (names[0] if names else {})
    display_name = primary_name.get("displayName") or primary_name.get("unstructuredName") or ""

    if not display_name:
        given = primary_name.get("givenName") or ""
        family = primary_name.get("familyName") or ""
        display_name = f"{given} {family}".strip()

    emails = person.get("emailAddresses") or []
    primary_email = next((e for e in emails if e.get("metadata", {}).get("primary")), None) or (emails[0] if emails else {})
    email_val = primary_email.get("value") or None

    phones = person.get("phoneNumbers") or []
    primary_phone = next((p for p in phones if p.get("metadata", {}).get("primary")), None) or (phones[0] if phones else {})
    phone_val = primary_phone.get("value") or None

    if not display_name and not email_val and not phone_val:
        return None

    if not display_name:
        display_name = email_val.split("@")[0] if email_val else phone_val or "Unknown Contact"

    orgs = person.get("organizations") or []
    primary_org = next((o for o in orgs if o.get("metadata", {}).get("primary")), None) or (orgs[0] if orgs else {})
    company_val = primary_org.get("name") or None
    role_val = primary_org.get("title") or None

    bios = person.get("biographies") or []
    notes_val = bios[0].get("value") if bios else None

    photos = person.get("photos") or []
    avatar_val = None
    if photos and not photos[0].get("default"):
        avatar_val = photos[0].get("url")

    return {
        "name": display_name,
        "email": email_val,
        "phone": phone_val,
        "company": company_val,
        "role": role_val,
        "category": "general",
        "notes": notes_val,
        "avatar_url": avatar_val,
        "starred": False,
    }


async def fetch_google_people_connections(access_token: str) -> list[dict[str, Any]]:
    """Fetch all contacts from Google People API."""
    url = (
        "https://people.googleapis.com/v1/people/me/connections"
        "?personFields=names,emailAddresses,phoneNumbers,organizations,biographies,photos"
        "&pageSize=1000"
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    contacts_list: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=30) as client:
        page_token = None
        while True:
            req_url = f"{url}&pageToken={page_token}" if page_token else url
            response = await client.get(req_url, headers=headers)
            if response.status_code != 200:
                error_msg = response.text
                try:
                    err_json = response.json()
                    error_msg = err_json.get("error", {}).get("message") or response.text
                except Exception:
                    pass
                response.raise_for_status()
            data = response.json()

            connections = data.get("connections") or []
            for person in connections:
                parsed = parse_google_person(person)
                if parsed:
                    contacts_list.append(parsed)

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    return contacts_list
