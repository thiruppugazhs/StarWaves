"""Live contest data fetchers for Codeforces, CodeChef, and LeetCode."""

import asyncio
from datetime import datetime, timezone

import httpx


def duration_label(seconds: int) -> str:
    hours, remainder = divmod(seconds, 3600)
    minutes = remainder // 60
    return " ".join(
        part
        for part in (
            f"{hours}h" if hours else "",
            f"{minutes}m" if minutes else "",
        )
        if part
    )


async def codeforces_contests(client: httpx.AsyncClient) -> dict | None:
    try:
        response = await client.get("https://codeforces.com/api/contest.list")
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") != "OK":
            raise ValueError(payload.get("comment", "Codeforces request failed."))
        contests = [
            {
                "id": f"cf-{contest['id']}",
                "name": contest["name"],
                "startsAt": datetime.fromtimestamp(
                    contest["startTimeSeconds"],
                    tz=timezone.utc,
                ).isoformat(),
                "duration": duration_label(contest["durationSeconds"]),
                "url": f"https://codeforces.com/contest/{contest['id']}",
            }
            for contest in payload["result"]
            if contest.get("phase") == "BEFORE"
        ]
        return {
            "id": "codeforces",
            "name": "Codeforces",
            "shortName": "CF",
            "description": "Live upcoming contests from Codeforces.",
            "contests": sorted(contests, key=lambda contest: contest["startsAt"]),
        }
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def codechef_contests(client: httpx.AsyncClient) -> dict | None:
    try:
        response = await client.get(
            "https://www.codechef.com/api/list/contests/future",
        )
        response.raise_for_status()
        payload = response.json()
        contests = [
            {
                "id": f"cc-{contest['contest_code']}",
                "name": contest["contest_name"],
                "startsAt": contest["contest_start_date_iso"],
                "duration": duration_label(int(contest["contest_duration"]) * 60),
                "url": f"https://www.codechef.com/{contest['contest_code']}",
            }
            for contest in payload.get("contests", [])
        ]
        return {
            "id": "codechef",
            "name": "CodeChef",
            "shortName": "CC",
            "description": "Live upcoming contests from CodeChef.",
            "contests": sorted(contests, key=lambda contest: contest["startsAt"]),
        }
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return None


async def leetcode_contests(client: httpx.AsyncClient) -> dict | None:
    queries = (
        (
            "topTwoContests",
            """
              query topTwoContests {
                topTwoContests { title titleSlug startTime duration }
              }
            """,
            "topTwoContests",
        ),
        (
            "contestList",
            """
              query contestList {
                allContests { title titleSlug startTime duration }
              }
            """,
            "allContests",
        ),
    )
    try:
        async def fetch_query(operation_name: str, query: str, field: str):
            for attempt in range(3):
                try:
                    response = await client.post(
                        "https://leetcode.com/graphql",
                        json={
                            "operationName": operation_name,
                            "query": query,
                            "variables": {},
                        },
                        headers={
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "Origin": "https://leetcode.com",
                            "Referer": "https://leetcode.com/contest/",
                        },
                    )
                    if response.is_success:
                        records = (response.json().get("data") or {}).get(
                            field,
                            [],
                        )
                        if records:
                            return records
                except httpx.HTTPError:
                    pass
                if attempt < 2:
                    await asyncio.sleep(1)
            return []

        tasks = [
            asyncio.create_task(fetch_query(operation_name, query, field))
            for operation_name, query, field in queries
        ]
        records = []
        for task in asyncio.as_completed(tasks):
            candidate = await task
            if candidate:
                records = candidate
                break
        for task in tasks:
            if not task.done():
                task.cancel()
        now = datetime.now(tz=timezone.utc).timestamp()
        contests = [
            {
                "id": f"lc-{contest['titleSlug']}",
                "name": contest["title"],
                "startsAt": datetime.fromtimestamp(
                    contest["startTime"],
                    tz=timezone.utc,
                ).isoformat(),
                "duration": duration_label(contest["duration"]),
                "url": f"https://leetcode.com/contest/{contest['titleSlug']}",
            }
            for contest in records
            if contest["startTime"] > now
        ]
        return {
            "id": "leetcode",
            "name": "LeetCode",
            "shortName": "LC",
            "description": "Live upcoming contests from LeetCode.",
            "contests": sorted(contests, key=lambda contest: contest["startsAt"]),
        }
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return None
