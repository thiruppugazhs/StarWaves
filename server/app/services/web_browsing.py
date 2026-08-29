import re
import urllib.parse
from typing import Any

import httpx
from bs4 import BeautifulSoup

from app.services.http_requests import HttpRequestError, _assert_public_url

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

SEARCH_TIMEOUT = httpx.Timeout(8.0, connect=3.0)
FETCH_TIMEOUT = httpx.Timeout(10.0, connect=4.0)
MAX_SEARCH_RESULTS = 10
DEFAULT_SEARCH_RESULTS = 5
MAX_PAGE_CHARS = 30000
DEFAULT_PAGE_CHARS = 12000

# Simple in-memory TTL caches to avoid repeated external scrapes
import time as _time
_search_cache: dict[str, tuple[float, dict]] = {}
_page_cache: dict[str, tuple[float, dict]] = {}
_SEARCH_TTL = 600  # 10 minutes
_PAGE_TTL = 600

UNWANTED_HTML_TAGS = [
    "script",
    "style",
    "noscript",
    "svg",
    "iframe",
    "nav",
    "footer",
    "header",
    "aside",
    "form",
    "button",
    "input",
    "select",
    "textarea",
]


def _clean_text(text: str) -> str:
    """Normalize whitespace and clean up scraped text."""
    if not text:
        return ""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    cleaned_lines: list[str] = []
    for line in lines:
        if line or (cleaned_lines and cleaned_lines[-1] != ""):
            cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def _extract_target_url(raw_url: str) -> str:
    """Extract actual destination URL from search engine redirect links."""
    if not raw_url:
        return ""
    if raw_url.startswith("//"):
        raw_url = "https:" + raw_url

    parsed = urllib.parse.urlparse(raw_url)
    if "duckduckgo.com" in parsed.netloc and "/l/" in parsed.path:
        query_params = urllib.parse.parse_qs(parsed.query)
        if "uddg" in query_params:
            return query_params["uddg"][0]
    return raw_url


def _search_duckduckgo_html(client: httpx.Client, query: str, num_results: int) -> list[dict[str, Any]]:
    """Search DuckDuckGo HTML endpoint and parse organic results."""
    results: list[dict[str, Any]] = []
    try:
        response = client.post(
            "https://html.duckduckgo.com/html/",
            data={"q": query, "b": ""},
            headers={
                "User-Agent": DEFAULT_USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://html.duckduckgo.com/",
            },
        )
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            for result_div in soup.select(".result"):
                title_elem = result_div.select_one(".result__title a") or result_div.select_one("a.result__url")
                snippet_elem = result_div.select_one(".result__snippet")
                if not title_elem:
                    continue

                raw_href = title_elem.get("href", "")
                url = _extract_target_url(raw_href)
                title = _clean_text(title_elem.get_text())
                snippet = _clean_text(snippet_elem.get_text()) if snippet_elem else ""

                if url and title and not url.startswith("https://duckduckgo.com/y.js"):
                    results.append({
                        "title": title,
                        "url": url,
                        "snippet": snippet,
                    })
                    if len(results) >= num_results:
                        break
    except Exception:
        pass
    return results


def _search_duckduckgo_api(client: httpx.Client, query: str, num_results: int) -> list[dict[str, Any]]:
    """Fallback search using DuckDuckGo Instant Answer API."""
    results: list[dict[str, Any]] = []
    try:
        response = client.get(
            "https://api.duckduckgo.com/",
            params={
                "q": query,
                "format": "json",
                "no_html": "1",
                "skip_disambig": "0",
            },
            headers={"User-Agent": DEFAULT_USER_AGENT},
        )
        if response.status_code == 200:
            data = response.json()
            abstract_text = data.get("AbstractText")
            abstract_url = data.get("AbstractURL")
            heading = data.get("Heading")
            if abstract_text and abstract_url:
                results.append({
                    "title": heading or query,
                    "url": abstract_url,
                    "snippet": abstract_text,
                })

            for topic in data.get("RelatedTopics", []):
                if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                    results.append({
                        "title": topic.get("Text", "").split(" - ")[0] if " - " in topic.get("Text", "") else topic.get("Text", ""),
                        "url": topic.get("FirstURL"),
                        "snippet": topic.get("Text", ""),
                    })
                    if len(results) >= num_results:
                        break
    except Exception:
        pass
    return results


def _search_duckduckgo_lite(client: httpx.Client, query: str, num_results: int) -> list[dict[str, Any]]:
    """Fallback search using DuckDuckGo Lite endpoint."""
    results: list[dict[str, Any]] = []
    try:
        response = client.post(
            "https://lite.duckduckgo.com/lite/",
            data={"q": query},
            headers={"User-Agent": DEFAULT_USER_AGENT},
        )
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            rows = soup.select("table tr")
            current_title = ""
            current_url = ""
            for row in rows:
                link = row.select_one(".result-link")
                if link:
                    current_title = _clean_text(link.get_text())
                    current_url = _extract_target_url(link.get("href", ""))
                    continue
                snippet = row.select_one(".result-snippet")
                if snippet and current_url and current_title:
                    results.append({
                        "title": current_title,
                        "url": current_url,
                        "snippet": _clean_text(snippet.get_text()),
                    })
                    current_title = ""
                    current_url = ""
                    if len(results) >= num_results:
                        break
    except Exception:
        pass
    return results


def search_web(query: str, num_results: int = DEFAULT_SEARCH_RESULTS) -> dict[str, Any]:
    """Search the open web and return top matching results with titles, snippets, and URLs."""
    query = (query or "").strip()
    if not query:
        raise ValueError("Search query cannot be empty.")

    num_results = max(1, min(int(num_results), MAX_SEARCH_RESULTS))
    cache_key = f"{query}:{num_results}"
    cached = _search_cache.get(cache_key)
    if cached and cached[0] > _time.monotonic():
        return cached[1]

    with httpx.Client(timeout=SEARCH_TIMEOUT, follow_redirects=True) as client:
        # Try primary HTML endpoint
        results = _search_duckduckgo_html(client, query, num_results)

        # Fallback to API if HTML returned empty
        if not results:
            results = _search_duckduckgo_api(client, query, num_results)

        # Fallback to Lite if still empty
        if not results:
            results = _search_duckduckgo_lite(client, query, num_results)

    result = {
        "query": query,
        "results": results,
        "total": len(results),
        "message": f"Found {len(results)} results for '{query}'." if results else f"No web search results found for '{query}'.",
    }
    _search_cache[cache_key] = (_time.monotonic() + _SEARCH_TTL, result)
    # cap cache
    if len(_search_cache) > 200:
        _search_cache.pop(next(iter(_search_cache)))
    return result


def fetch_web_page(url: str, max_chars: int = DEFAULT_PAGE_CHARS) -> dict[str, Any]:
    """Fetch and extract readable text/markdown content from an external web URL."""
    url = (url or "").strip()
    if not url:
        raise ValueError("URL cannot be empty.")

    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    parsed = urllib.parse.urlparse(url)
    if not parsed.netloc:
        raise ValueError(f"Invalid web URL: {url}")
    try:
        _assert_public_url(url)
    except HttpRequestError as exc:
        raise ValueError(str(exc)) from exc

    max_chars = max(500, min(int(max_chars), MAX_PAGE_CHARS))
    cache_key = f"{url}:{max_chars}"
    cached = _page_cache.get(cache_key)
    if cached and cached[0] > _time.monotonic():
        return cached[1]

    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        with httpx.Client(timeout=FETCH_TIMEOUT, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            final_url = str(response.url)
            try:
                _assert_public_url(final_url)
            except HttpRequestError as exc:
                raise ValueError(f"Redirect to private address blocked: {final_url}: {exc}") from exc
    except httpx.TimeoutException:
        raise ValueError(f"Request to {url} timed out.")
    except httpx.HTTPStatusError as e:
        raise ValueError(f"HTTP error {e.response.status_code} while fetching {url}.")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Failed to fetch {url}: {str(e)}") from e

    content_type = response.headers.get("content-type", "").lower()

    if "application/json" in content_type:
        text = response.text[:max_chars]
        is_truncated = len(response.text) > max_chars
        result = {
            "url": final_url,
            "title": "JSON Document",
            "description": "",
            "content": text,
            "truncated": is_truncated,
            "content_type": content_type,
        }
        _page_cache[cache_key] = (_time.monotonic() + _PAGE_TTL, result)
        return result

    if "text/plain" in content_type or "text/markdown" in content_type:
        text = response.text[:max_chars]
        is_truncated = len(response.text) > max_chars
        result = {
            "url": final_url,
            "title": "Plain Text Document",
            "description": "",
            "content": text,
            "truncated": is_truncated,
            "content_type": content_type,
        }
        _page_cache[cache_key] = (_time.monotonic() + _PAGE_TTL, result)
        return result

    # HTML parsing
    soup = BeautifulSoup(response.text, "html.parser")

    # Extract title
    title_tag = soup.find("title")
    title = _clean_text(title_tag.get_text()) if title_tag else ""
    if not title:
        og_title = soup.find("meta", property="og:title")
        title = og_title.get("content", "").strip() if og_title else ""

    # Extract description
    meta_desc = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
    description = meta_desc.get("content", "").strip() if meta_desc else ""

    # Remove non-content tags
    for tag in soup.find_all(UNWANTED_HTML_TAGS):
        tag.decompose()

    # Prioritize main content containers if present
    main_container = soup.find("main") or soup.find("article") or soup.find(id=re.compile(r"content|main|article", re.I)) or soup.find("body") or soup

    # Format headings and paragraphs
    for h1 in main_container.find_all("h1"):
        h1.replace_with(f"\n\n# {h1.get_text().strip()}\n")
    for h2 in main_container.find_all("h2"):
        h2.replace_with(f"\n\n## {h2.get_text().strip()}\n")
    for h3 in main_container.find_all("h3"):
        h3.replace_with(f"\n\n### {h3.get_text().strip()}\n")
    for li in main_container.find_all("li"):
        li.replace_with(f"\n- {li.get_text().strip()}")
    for p in main_container.find_all("p"):
        p.replace_with(f"\n\n{p.get_text().strip()}\n")

    raw_text = _clean_text(main_container.get_text())
    is_truncated = len(raw_text) > max_chars
    content = raw_text[:max_chars]

    if not content and description:
        content = description

    result = {
        "url": final_url,
        "title": title or "Web Page",
        "description": description,
        "content": content or "No readable text content extracted from page.",
        "truncated": is_truncated,
        "content_type": content_type,
    }
    _page_cache[cache_key] = (_time.monotonic() + _PAGE_TTL, result)
    if len(_page_cache) > 200:
        _page_cache.pop(next(iter(_page_cache)))
    return result


def browse_web(
    query: str | None = None,
    url: str | None = None,
    num_results: int = DEFAULT_SEARCH_RESULTS,
    max_chars: int = DEFAULT_PAGE_CHARS,
) -> dict[str, Any]:
    """Unified web browsing tool: searches the web if query provided, or fetches page if url provided."""
    query = (query or "").strip()
    url = (url or "").strip()

    if not query and not url:
        raise ValueError("Either 'query' or 'url' must be provided to browse the web.")

    result: dict[str, Any] = {}

    if url:
        result["page"] = fetch_web_page(url, max_chars=max_chars)

    if query:
        result["search"] = search_web(query, num_results=num_results)

    return result
