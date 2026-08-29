import asyncio
import re
import time
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

TIMEOUT = 15.0
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
STATS_CACHE_TTL = 5 * 60
_stats_cache: dict[tuple[str, str, str], tuple[float, dict]] = {}
_platform_cache: dict[tuple[str, str], tuple[float, dict]] = {}


def profile_name(value: str, platform: str) -> str:
    value = value.strip().rstrip("/")
    if not value:
        return ""
    if "://" not in value:
        return value.lstrip("@")
    parts = [part for part in urlparse(value).path.split("/") if part]
    if not parts:
        return ""
    if platform == "leetcode" and parts[-2:-1] == ["u"]:
        return parts[-1]
    return parts[-1]


def codeforces_rank(rating: int | None) -> str | None:
    if rating is None:
        return None
    thresholds = [
        (3000, "Legendary Grandmaster"),
        (2600, "International Grandmaster"),
        (2400, "Grandmaster"),
        (2300, "International Master"),
        (2100, "Master"),
        (1900, "Candidate Master"),
        (1600, "Expert"),
        (1400, "Specialist"),
        (1200, "Pupil"),
    ]
    return next((name for minimum, name in thresholds if rating >= minimum), "Newbie")


async def parse_codeforces(client: httpx.AsyncClient, value: str) -> dict:
    handle = profile_name(value, "codeforces")
    if not handle:
        return {"configured": False, "status": "missing"}
    response = await client.get(
        "https://codeforces.com/api/user.rating",
        params={"handle": handle},
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") != "OK":
        raise ValueError(payload.get("comment", "Codeforces profile was not found."))
    history = payload.get("result", [])
    latest = history[-1] if history else {}
    ratings = [entry.get("newRating") for entry in history if entry.get("newRating") is not None]
    rating = latest.get("newRating")
    return {
        "configured": True,
        "status": "ok",
        "handle": handle,
        "profileUrl": f"https://codeforces.com/profile/{handle}",
        "rating": rating,
        "maxRating": max(ratings) if ratings else None,
        "rank": codeforces_rank(rating),
        "contests": len(history),
        "ratingChange": (
            rating - latest.get("oldRating", rating) if rating is not None else None
        ),
    }


async def parse_leetcode(client: httpx.AsyncClient, value: str) -> dict:
    username = profile_name(value, "leetcode")
    if not username:
        return {"configured": False, "status": "missing"}
    queries = {
        "profile": (
            "getUserProfile",
            """
              query getUserProfile($username: String!) {
                matchedUser(username: $username) {
                  username
                  submitStats {
                    acSubmissionNum { difficulty count }
                  }
                  userCalendar {
                    streak
                    totalActiveDays
                  }
                }
              }
            """,
        ),
        "ranking": (
            "userContestRankingInfo",
            """
              query userContestRankingInfo($username: String!) {
                userContestRanking(username: $username) {
                  attendedContestsCount
                  rating
                  globalRanking
                  totalParticipants
                  topPercentage
                  badge { name }
                }
              }
            """,
        ),
        "questions": (
            "allQuestionsCount",
            """
              query allQuestionsCount {
                allQuestionsCount { difficulty count }
              }
            """,
        ),
    }

    async def request_query(operation_name: str, query: str) -> dict:
        for attempt in range(2):
            try:
                response = await client.post(
                    "https://leetcode.com/graphql/",
                    json={
                        "operationName": operation_name,
                        "query": query,
                        "variables": {"username": username},
                    },
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Origin": "https://leetcode.com",
                        "Referer": f"https://leetcode.com/u/{username}/",
                    },
                )
            except httpx.HTTPError:
                if attempt == 0:
                    await asyncio.sleep(1)
                    continue
                return {}
            if response.status_code not in {404, 429, 502, 503, 504}:
                response.raise_for_status()
                return response.json().get("data") or {}
            if attempt == 0:
                await asyncio.sleep(1)
        return {}

    ranking_data, profile_data, questions_data = await asyncio.gather(
        request_query(*queries["ranking"]),
        request_query(*queries["profile"]),
        request_query(*queries["questions"]),
    )
    if not ranking_data.get("userContestRanking"):
        ranking_data = await request_query(*queries["ranking"])
    data = {**profile_data, **ranking_data, **questions_data}
    user = data.get("matchedUser")
    if not user:
        raise ValueError("LeetCode profile could not be loaded.")
    solved = {
        item["difficulty"].lower(): item["count"]
        for item in user.get("submitStats", {}).get("acSubmissionNum", [])
    }
    totals = {
        item["difficulty"].lower(): item["count"]
        for item in data.get("allQuestionsCount", [])
    }
    ranking = data.get("userContestRanking") or {}
    calendar = user.get("userCalendar") or {}
    return {
        "configured": True,
        "status": "ok",
        "username": username,
        "profileUrl": f"https://leetcode.com/u/{username}/",
        "solved": solved.get("all"),
        "total": totals.get("all"),
        "easy": solved.get("easy"),
        "medium": solved.get("medium"),
        "hard": solved.get("hard"),
        "streak": calendar.get("streak") or 0,
        "totalActiveDays": calendar.get("totalActiveDays"),
        "contestRating": round(ranking["rating"]) if ranking.get("rating") else None,
        "contests": ranking.get("attendedContestsCount"),
        "globalRank": ranking.get("globalRanking"),
    }


def first_number(text: str) -> int | None:
    match = re.search(r"[\d,]+", text or "")
    return int(match.group().replace(",", "")) if match else None


async def parse_codechef(client: httpx.AsyncClient, value: str) -> dict:
    username = profile_name(value, "codechef")
    if not username:
        return {"configured": False, "status": "missing"}
    response = await client.get(f"https://www.codechef.com/users/{username}")
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    rating_node = soup.select_one(".rating-number")
    if not rating_node:
        raise ValueError("CodeChef profile was not found or could not be parsed.")
    star_node = soup.select_one(".rating-star")
    rank_nodes = soup.select(".rating-ranks strong")
    contest_node = soup.select_one(".contest-participated-count")
    highest_text = soup.find(string=re.compile(r"Highest Rating", re.I))
    highest = first_number(highest_text.parent.get_text(" ", strip=True)) if highest_text else None

    rating_change = None
    rating_history_match = re.search(
        r"\[\[\d{10,},\s*\d+\][,\s]*(?:\n?\s*\[?\d{10,},\s*\d+\][,\s]*)*\]",
        response.text,
    )
    if rating_history_match:
        entries = re.findall(r"\[(\d{10,}),\s*(\d+)\]", rating_history_match.group(0))
        ratings_only = [int(rating) for _, rating in entries]
        if len(ratings_only) >= 2:
            rating_change = ratings_only[-1] - ratings_only[-2]

    return {
        "configured": True,
        "status": "ok",
        "username": username,
        "profileUrl": f"https://www.codechef.com/users/{username}",
        "rating": first_number(rating_node.get_text(" ", strip=True)),
        "maxRating": highest,
        "stars": (star_node.get_text(" ", strip=True).count("★") if star_node else None),
        "globalRank": (
            first_number(rank_nodes[0].get_text(" ", strip=True)) if rank_nodes else None
        ),
        "countryRank": (
            first_number(rank_nodes[1].get_text(" ", strip=True))
            if len(rank_nodes) > 1
            else None
        ),
        "contests": (
            first_number(contest_node.get_text(" ", strip=True))
            if contest_node
            else None
        ),
        "ratingChange": rating_change,
    }


async def load_coding_stats(settings: dict) -> dict:
    parsers = {
        "codeforces": parse_codeforces,
        "codechef": parse_codechef,
        "leetcode": parse_leetcode,
    }
    cache_key = tuple(settings.get(platform, "").strip() for platform in parsers)
    cached = _stats_cache.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return cached[1]

    async def run_parser(
        client: httpx.AsyncClient,
        platform: str,
        parser,
    ) -> tuple[str, dict]:
        try:
            result = await parser(client, settings.get(platform, ""))
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            result = {
                "configured": bool(settings.get(platform, "").strip()),
                "status": "unavailable",
                "error": str(error),
            }
        return platform, result

    async with httpx.AsyncClient(
        timeout=TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        parsed = await asyncio.gather(
            *(
                run_parser(client, platform, parser)
                for platform, parser in parsers.items()
            ),
        )
    results = dict(parsed)
    cache_seconds = (
        STATS_CACHE_TTL
        if all(result["status"] != "unavailable" for result in results.values())
        else 30
    )
    _stats_cache[cache_key] = (time.monotonic() + cache_seconds, results)
    return results


async def load_platform_coding_stats(platform: str, value: str) -> dict:
    parsers = {
        "codeforces": parse_codeforces,
        "codechef": parse_codechef,
        "leetcode": parse_leetcode,
    }
    parser = parsers[platform]
    cache_key = (platform, value.strip())
    cached = _platform_cache.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return cached[1]

    async with httpx.AsyncClient(
        timeout=TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        try:
            result = await parser(client, value)
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            result = {
                "configured": bool(value.strip()),
                "status": "unavailable",
                "error": str(error),
            }
    cache_seconds = STATS_CACHE_TTL if result["status"] != "unavailable" else 30
    _platform_cache[cache_key] = (time.monotonic() + cache_seconds, result)
    return result
