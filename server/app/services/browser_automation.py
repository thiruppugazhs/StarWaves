"""Interactive browser automation service for Eve tools, backed by headless Playwright.

One shared Chromium instance is launched lazily; each Eve user gets one page
that persists across tool calls so navigate → click → type → extract flows work.
Playwright is imported lazily so the server still boots without it installed.
"""

import logging

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_MS = 15000
NAVIGATION_TIMEOUT_MS = 30000
EXTRACT_MAX_CHARS = 12000

_pages: dict[str, object] = {}
_playwright = None
_browser = None


class BrowserAutomationError(RuntimeError):
    """Raised when Playwright is unavailable or a browser action fails."""


def _ensure_browser():
    global _playwright, _browser
    if _browser and _browser.is_connected():
        return _browser
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise BrowserAutomationError(
            "Playwright is not installed on the server. Run `pip install playwright && playwright install chromium`."
        ) from exc
    try:
        _playwright = sync_playwright().start()
        _browser = _playwright.chromium.launch(headless=True)
    except Exception as exc:
        raise BrowserAutomationError(f"Could not launch headless Chromium: {exc}") from exc
    return _browser


def _get_page(user_id: str):
    page = _pages.get(user_id)
    if page and not page.is_closed():
        return page
    page = _ensure_browser().new_page()
    page.set_default_timeout(DEFAULT_TIMEOUT_MS)
    _pages[user_id] = page
    return page


def close_user_page(user_id: str) -> None:
    page = _pages.pop(user_id, None)
    if page and not page.is_closed():
        page.close()


def browser_navigate(user_id: str, url: str) -> dict:
    from app.services.http_requests import HttpRequestError, _assert_public_url

    # Block SSRF to private ranges / metadata before navigating
    try:
        _assert_public_url(url)
    except HttpRequestError as exc:
        raise BrowserAutomationError(str(exc)) from exc
    page = _get_page(user_id)
    try:
        response = page.goto(url, timeout=NAVIGATION_TIMEOUT_MS, wait_until="domcontentloaded")
    except Exception as exc:
        raise BrowserAutomationError(f"Navigation to {url} failed: {exc}") from exc
    status = response.status if response else None
    title = page.title()
    return {"url": page.url, "status": status, "title": title}


def browser_click(user_id: str, selector: str) -> dict:
    page = _get_page(user_id)
    try:
        page.click(selector, timeout=DEFAULT_TIMEOUT_MS)
    except Exception as exc:
        raise BrowserAutomationError(f"Click on '{selector}' failed: {exc}") from exc
    return {"clicked": selector, "url": page.url, "title": page.title()}


def browser_type(user_id: str, selector: str, text: str, submit: bool = False) -> dict:
    page = _get_page(user_id)
    try:
        page.fill(selector, text, timeout=DEFAULT_TIMEOUT_MS)
        if submit:
            page.press(selector, "Enter")
            page.wait_for_load_state("domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
    except Exception as exc:
        raise BrowserAutomationError(f"Typing into '{selector}' failed: {exc}") from exc
    return {"typed": selector, "url": page.url, "title": page.title()}


def browser_extract_text(user_id: str, selector: str | None = None) -> dict:
    page = _get_page(user_id)
    try:
        if selector:
            content = page.inner_text(selector, timeout=DEFAULT_TIMEOUT_MS)
        else:
            content = page.inner_text("body", timeout=DEFAULT_TIMEOUT_MS)
    except Exception as exc:
        raise BrowserAutomationError(f"Text extraction failed: {exc}") from exc
    truncated = len(content) > EXTRACT_MAX_CHARS
    return {
        "url": page.url,
        "title": page.title(),
        "text": content[:EXTRACT_MAX_CHARS],
        "truncated": truncated,
    }


def browser_screenshot(user_id: str, full_page: bool = False) -> bytes:
    page = _get_page(user_id)
    try:
        return page.screenshot(full_page=full_page, type="png")
    except Exception as exc:
        raise BrowserAutomationError(f"Screenshot failed: {exc}") from exc
