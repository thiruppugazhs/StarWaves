"""Google Calendar data service: token helpers and calendar/event aggregation.

OAuth config, token crypto/exchange, and profile helpers live in
``app.services.oauth``; this module owns the Calendar-specific data fetching.
"""

import asyncio
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from itsdangerous import URLSafeTimedSerializer

from app.services.oauth import (
    decrypt_google_token,
    encrypt_google_token,
    exchange_google_code,
    google_oauth_state_serializer,
    google_profile,
    google_token_cipher,
    refresh_google_token,
    require_google_oauth_config,
)


def google_state_serializer() -> URLSafeTimedSerializer:
    """Compatibility wrapper: Calendar OAuth state serializer with its default salt."""
    return google_oauth_state_serializer("starwaves-google-calendar-oauth")


async def google_calendar_data(access_token: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}"}
    now = datetime.now(timezone.utc)
    time_min = datetime(now.year - 1, 1, 1, tzinfo=timezone.utc).isoformat()
    time_max = datetime(now.year + 2, 12, 31, 23, 59, 59, tzinfo=timezone.utc).isoformat()

    async with httpx.AsyncClient(
        base_url="https://www.googleapis.com/calendar/v3",
        headers=headers,
        timeout=30,
    ) as client:
        calendars = []
        page_token = None
        while True:
            response = await client.get(
                "/users/me/calendarList",
                params={
                    "minAccessRole": "reader",
                    "showHidden": "false",
                    **({"pageToken": page_token} if page_token else {}),
                },
            )
            response.raise_for_status()
            payload = response.json()
            calendars.extend(payload.get("items", []))
            page_token = payload.get("nextPageToken")
            if not page_token:
                break

        async def fetch_calendar_events(cal):
            cal_events = []
            page_token = None
            while True:
                response = await client.get(
                    f"/calendars/{quote(cal['id'], safe='')}/events",
                    params={
                        "timeMin": time_min,
                        "timeMax": time_max,
                        "singleEvents": "true",
                        "orderBy": "startTime",
                        "showDeleted": "false",
                        "maxResults": "2500",
                        **({"pageToken": page_token} if page_token else {}),
                    },
                )
                response.raise_for_status()
                payload = response.json()
                for event in payload.get("items", []):
                    if event.get("status") == "cancelled" or not event.get("start"):
                        continue
                    start = event["start"]
                    end = event.get("end", start)
                    cal_events.append(
                        {
                            "id": f"{cal['id']}:{event['id']}",
                            "googleEventId": event["id"],
                            "calendarId": cal["id"],
                            "calendarName": cal.get("summaryOverride")
                            or cal.get("summary", "Calendar"),
                            "calendarColor": cal.get("backgroundColor", "#4285f4"),
                            "title": event.get("summary", "(Untitled event)"),
                            "description": event.get("description", ""),
                            "location": event.get("location", ""),
                            "htmlLink": event.get("htmlLink", ""),
                            "start": start.get("dateTime") or start.get("date"),
                            "end": end.get("dateTime") or end.get("date"),
                            "allDay": "date" in start,
                        },
                    )
                page_token = payload.get("nextPageToken")
                if not page_token:
                    break
            return cal_events

        calendar_results = await asyncio.gather(
            *(fetch_calendar_events(cal) for cal in calendars),
        )
        events = [event for cal_events in calendar_results for event in cal_events]

    return {
        "calendars": [
            {
                "id": calendar["id"],
                "name": calendar.get("summaryOverride")
                or calendar.get("summary", "Calendar"),
                "color": calendar.get("backgroundColor", "#4285f4"),
                "primary": bool(calendar.get("primary")),
            }
            for calendar in calendars
        ],
        "events": events,
    }
