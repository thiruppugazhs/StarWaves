import asyncio
import hashlib
import time
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

SOURCE_CATALOG = [
    {
        "id": "devpost",
        "name": "Devpost",
        "description": "Public online and global developer hackathons.",
        "url": "https://devpost.com/hackathons",
    },
    {
        "id": "unstop",
        "name": "Unstop",
        "description": "Active student, university, and company hackathons.",
        "url": "https://unstop.com/hackathons",
    },
    {
        "id": "mlh",
        "name": "Major League Hacking",
        "description": "Official MLH member events and Global Hack Weeks.",
        "url": "https://mlh.io/events",
    },
]
SOURCE_IDS = {source["id"] for source in SOURCE_CATALOG}
HACKATHON_CACHE_TTL = 10 * 60
# Keep dashboard requests responsive when a public provider is slow. A failed
# provider is already treated as optional, so waiting several seconds longer
# does not improve the response users see.
HACKATHON_REQUEST_TIMEOUT = httpx.Timeout(4.0, connect=2.0)
_hackathon_cache: dict[tuple[str, ...], tuple[float, list[dict]]] = {}


def parse_devpost_date_range(value: str) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start_text, end_text = (part.strip() for part in value.split(" - ", 1))
    end_value = end_text if end_text.count(",") else f"{end_text}, {now.year}"
    end = datetime.strptime(end_value, "%b %d, %Y").replace(
        tzinfo=timezone.utc,
    )
    start_value = start_text if start_text.count(",") else f"{start_text}, {end.year}"
    start = datetime.strptime(start_value, "%b %d, %Y").replace(
        tzinfo=timezone.utc,
    )
    if start > end:
        start = start.replace(year=start.year - 1)
    return start, end.replace(hour=23, minute=59, second=59)


async def devpost_hackathons(client: httpx.AsyncClient) -> list[dict]:
    response = await client.get(
        "https://devpost.com/api/hackathons",
        params=[("status[]", "open"), ("page", "1")],
    )
    response.raise_for_status()
    result = []
    for item in response.json().get("hackathons", []):
        start, end = parse_devpost_date_range(item["submission_period_dates"])
        result.append(
            {
                "id": f"devpost-{item['id']}",
                "title": item["title"],
                "organizer": item.get("organization_name") or "Devpost",
                "starts_at": start.isoformat(),
                "ends_at": end.isoformat(),
                "mode": item.get("displayed_location", {}).get("location", "Online"),
                "team_size": "See event",
                "tags": [theme["name"] for theme in item.get("themes", [])],
                "url": item["url"],
                "source": "devpost",
            },
        )
    return result


async def unstop_hackathons(client: httpx.AsyncClient) -> list[dict]:
    response = await client.get(
        "https://unstop.com/api/public/opportunity/search-result",
        params={"opportunity": "hackathons", "page": "1", "per_page": "50"},
    )
    response.raise_for_status()
    now = datetime.now(timezone.utc)
    result = []
    for item in response.json().get("data", {}).get("data", []):
        if not item.get("regn_open") or not item.get("end_date"):
            continue
        end = datetime.fromisoformat(item["end_date"])
        if end.astimezone(timezone.utc) < now:
            continue
        organization = item.get("organisation") or {}
        result.append(
            {
                "id": f"unstop-{item['id']}",
                "title": item["title"],
                "organizer": organization.get("name") or "Unstop",
                "starts_at": now.isoformat(),
                "ends_at": end.isoformat(),
                "mode": "Online" if item.get("region") == "online" else "In person",
                "team_size": "See event",
                "tags": [
                    tag.get("name", "")
                    for tag in item.get("tags", [])
                    if isinstance(tag, dict) and tag.get("name")
                ],
                "url": item.get("seo_url") or f"https://unstop.com/{item['public_url']}",
                "source": "unstop",
            },
        )
    return result


async def mlh_hackathons(client: httpx.AsyncClient) -> list[dict]:
    now = datetime.now(timezone.utc)
    season = now.year + 1 if now.month >= 7 else now.year
    response = await client.get(f"https://mlh.io/seasons/{season}/events")
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    result = []
    for event in soup.select('[itemscope][itemtype="https://schema.org/Event"]'):
        name = event.select_one('[itemprop="name"]')
        start = event.select_one('[itemprop="startDate"]')
        end = event.select_one('[itemprop="endDate"]')
        link = event.select_one('[itemprop="url"]')
        mode = event.select_one('[itemprop="eventAttendanceMode"]')
        if not all((name, start, end, link)):
            continue
        end_date = datetime.fromisoformat(end.get("content") or end.get("datetime"))
        if end_date.astimezone(timezone.utc) < now:
            continue
        url = link.get("content") or link.get("href")
        event_id = event.get("id") or url
        result.append(
            {
                "id": f"mlh-{hashlib.sha256(event_id.encode()).hexdigest()[:20]}",
                "title": name.get("content") or name.get_text(" ", strip=True),
                "organizer": "Major League Hacking",
                "starts_at": start.get("content") or start.get("datetime"),
                "ends_at": end.get("content") or end.get("datetime"),
                "mode": (
                    "Online"
                    if mode and "Online" in (mode.get("content") or "")
                    else "In person"
                ),
                "team_size": "See event",
                "tags": ["MLH"],
                "url": url,
                "source": "mlh",
            },
        )
    return result


async def fetch_enabled_hackathons(enabled_sources: list[str]) -> list[dict]:
    cache_key = tuple(sorted(set(enabled_sources) & SOURCE_IDS))
    cached = _hackathon_cache.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return cached[1]

    fetchers = {
        "devpost": devpost_hackathons,
        "unstop": unstop_hackathons,
        "mlh": mlh_hackathons,
    }
    headers = {"User-Agent": "StarWaves/0.1 (+https://starwaves.app)"}
    if not cache_key:
        return []

    async with httpx.AsyncClient(
        timeout=HACKATHON_REQUEST_TIMEOUT,
        follow_redirects=True,
        headers=headers,
    ) as client:
        async def fetch(source_id: str) -> list[dict]:
            try:
                return await fetchers[source_id](client)
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                return []

        batches = await asyncio.gather(*(fetch(source_id) for source_id in cache_key))
    result = [item for batch in batches for item in batch]
    if not result and cached:
        return cached[1]
    result.sort(key=lambda item: item["starts_at"])
    _hackathon_cache[cache_key] = (
        time.monotonic() + HACKATHON_CACHE_TTL,
        result,
    )
    return result
