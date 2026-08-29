"""UI preferences service — single responsibility: per-user UI overrides persistence.

Stored at ``users/{uid}/settings/ui-preferences`` (SQL compat layer maps to
``user_settings`` table). Versioned with last-20 history.
"""

import re
from datetime import datetime, timezone
from typing import Any

from app.db import SERVER_TIMESTAMP, SqlClient
from app.services.eve.constants import WORKSPACE_PAGES

UI_PREFS_DOC = "ui-preferences"
MAX_HISTORY = 20
MAX_CSS_LENGTH = 5000

# Allowlisted token keys — mirrors tokens.css + themes presets
ALLOWED_TOKEN_RE = re.compile(r"^--([a-z0-9-]+)$")
ALLOWED_TOKENS = {
    # colors
    "--bg-primary",
    "--bg-secondary",
    "--bg-tertiary",
    "--bg-card",
    "--bg-card-hover",
    "--bg-hover",
    "--bg-overlay",
    "--text-primary",
    "--text-secondary",
    "--text-muted",
    "--text-inverse",
    "--color-primary",
    "--color-primary-hover",
    "--color-primary-light",
    "--color-accent",
    "--border-color",
    "--border-light",
    "--border-heavy",
    "--border-focus",
    "--scrollbar-track",
    "--scrollbar-thumb",
    "--scrollbar-thumb-hover",
    "--color-success",
    "--color-warning",
    "--color-danger",
    "--color-purple",
    # radii
    "--radius-xs",
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-xl",
    "--radius-full",
    # layout
    "--layout-max-width",
    "--layout-gutter",
    "--layout-section-gap",
    "--layout-card-padding",
    # shadows & transitions
    "--shadow-sm",
    "--shadow-md",
    "--shadow-lg",
    "--shadow-surface",
    "--shadow-lifted",
    "--shadow-inset",
    "--shadow-focus",
    "--transition-fast",
    "--transition-normal",
    "--transition-slow",
    "--font-family",
}

# Valid pages = WORKSPACE_PAGES + custom:slug + global sentinel
CUSTOM_PAGE_RE = re.compile(r"^custom:[a-z0-9-]+$")
_GRAYS = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

# Dangerous CSS patterns — blocked even though we inject via <style>
_BLOCKED_CSS_PATTERNS = [
    re.compile(r"@import", re.I),
    re.compile(r"expression\s*\(", re.I),
    re.compile(r"javascript\s*:", re.I),
    re.compile(r"url\s*\(\s*['\"]?\s*data\s*:", re.I),
    re.compile(r"url\s*\(\s*['\"]?\s*https?:", re.I),
    re.compile(r"behavior\s*:", re.I),
    re.compile(r"-moz-binding", re.I),
]


def _reference(database: SqlClient, user_id: str):
    return (
        database.collection("users")
        .document(user_id)
        .collection("settings")
        .document(UI_PREFS_DOC)
    )


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize_css(css: str) -> str:
    """Strip blocked patterns; truncate to MAX_CSS_LENGTH."""
    if len(css) > MAX_CSS_LENGTH:
        css = css[:MAX_CSS_LENGTH]
    for pat in _BLOCKED_CSS_PATTERNS:
        if pat.search(css):
            raise ValueError(f"Blocked CSS pattern: {pat.pattern}")
    # also strip < > to prevent HTML injection
    if "<" in css or ">" in css:
        raise ValueError("CSS must not contain < or > characters.")
    return css.strip()


def _is_gray_color(value: str) -> bool:
    """Check if hex color is grayscale (r==g==b)."""
    m = _GRAYS.match(value.strip())
    if not m:
        return False
    hexv = m.group(1)
    if len(hexv) == 3:
        hexv = "".join(c * 2 for c in hexv)
    r, g, b = int(hexv[0:2], 16), int(hexv[2:4], 16), int(hexv[4:6], 16)
    return r == g == b


def _validate_tokens(tokens: dict[str, str]) -> dict[str, str]:
    cleaned: dict[str, str] = {}
    for k, v in tokens.items():
        if k not in ALLOWED_TOKENS and not ALLOWED_TOKEN_RE.match(k):
            raise ValueError(f"Unsupported token: {k}")
        if k not in ALLOWED_TOKENS:
            raise ValueError(f"Token not allowlisted: {k}")
        if not isinstance(v, str) or not v.strip():
            raise ValueError(f"Token {k} must be a non-empty string.")
        if len(v) > 500:
            raise ValueError(f"Token {k} value too long.")
        if "<" in v or ">" in v:
            raise ValueError(f"Token {k} must not contain < or >.")
        cleaned[k] = v.strip()
    return cleaned


def _validate_page(page: str | None) -> str | None:
    if page is None:
        return None
    p = page.strip()
    if p in WORKSPACE_PAGES:
        return p
    if CUSTOM_PAGE_RE.match(p):
        return p
    raise ValueError(f"Unsupported page: {page}. Allowed: {', '.join(WORKSPACE_PAGES)} or custom:<slug>")


def load_raw(database: SqlClient, user_id: str) -> dict[str, Any]:
    snapshot = _reference(database, user_id).get()
    if not snapshot.exists:
        return {}
    return snapshot.to_dict() or {}


def get_ui_preferences(database: SqlClient, user_id: str) -> dict[str, Any]:
    raw = load_raw(database, user_id)
    if not raw:
        return {
            "version": 1,
            "global_tokens": {},
            "global_css": "",
            "pages": {},
            "history": [],
            "updated_at": None,
        }
    return {
        "version": int(raw.get("version", 1)),
        "global_tokens": raw.get("global_tokens", {}),
        "global_css": raw.get("global_css", ""),
        "pages": raw.get("pages", {}),
        "history": raw.get("history", []),
        "updated_at": raw.get("updated_at"),
    }


def _push_history(raw: dict[str, Any], cause: str) -> None:
    history = list(raw.get("history", []))
    snap = {
        "version": int(raw.get("version", 1)),
        "at": raw.get("updated_at") or _utc_now(),
        "cause": cause,
        "snapshot": {
            "global_tokens": dict(raw.get("global_tokens", {})),
            "global_css": raw.get("global_css", ""),
            "pages": dict(raw.get("pages", {})),
        },
    }
    history.append(snap)
    if len(history) > MAX_HISTORY:
        history = history[-MAX_HISTORY:]
    raw["history"] = history


def save_tokens(
    database: SqlClient,
    user_id: str,
    tokens: dict[str, str],
    page: str | None = None,
    reason: str | None = None,
) -> dict[str, Any]:
    cleaned = _validate_tokens(tokens)
    validated_page = _validate_page(page)
    raw = load_raw(database, user_id)
    if not raw:
        raw = {"version": 1, "global_tokens": {}, "global_css": "", "pages": {}, "history": []}
    _push_history(raw, f"tokens:{validated_page or 'global'}")
    if validated_page is None:
        merged = dict(raw.get("global_tokens", {}))
        merged.update(cleaned)
        raw["global_tokens"] = merged
    else:
        pages = dict(raw.get("pages", {}))
        entry = dict(pages.get(validated_page, {}))
        pt = dict(entry.get("tokens", {}))
        pt.update(cleaned)
        entry["tokens"] = pt
        pages[validated_page] = entry
        raw["pages"] = pages
    raw["version"] = int(raw.get("version", 1)) + 1
    raw["updated_at"] = _utc_now()
    if reason:
        raw["last_reason"] = reason[:500]
    _reference(database, user_id).set(
        {
            "version": raw["version"],
            "global_tokens": raw.get("global_tokens", {}),
            "global_css": raw.get("global_css", ""),
            "pages": raw.get("pages", {}),
            "history": raw.get("history", []),
            "updated_at": SERVER_TIMESTAMP,
            "last_reason": raw.get("last_reason", ""),
        },
        merge=True,
    )
    return get_ui_preferences(database, user_id)


def save_css(
    database: SqlClient,
    user_id: str,
    css: str,
    page: str | None = None,
) -> dict[str, Any]:
    cleaned_css = _sanitize_css(css)
    validated_page = _validate_page(page)
    raw = load_raw(database, user_id)
    if not raw:
        raw = {"version": 1, "global_tokens": {}, "global_css": "", "pages": {}, "history": []}
    _push_history(raw, f"css:{validated_page or 'global'}")
    if validated_page is None:
        raw["global_css"] = cleaned_css
    else:
        pages = dict(raw.get("pages", {}))
        entry = dict(pages.get(validated_page, {}))
        entry["css"] = cleaned_css
        pages[validated_page] = entry
        raw["pages"] = pages
    raw["version"] = int(raw.get("version", 1)) + 1
    raw["updated_at"] = _utc_now()
    _reference(database, user_id).set(
        {
            "version": raw["version"],
            "global_tokens": raw.get("global_tokens", {}),
            "global_css": cleaned_css if validated_page is None else raw.get("global_css", ""),
            "pages": raw.get("pages", {}),
            "history": raw.get("history", []),
            "updated_at": SERVER_TIMESTAMP,
        },
        merge=True,
    )
    # global_css already set via merge; pages handled
    if validated_page is not None:
        # need to ensure global_css preserved correctly
        _reference(database, user_id).set({"global_css": raw.get("global_css", "")}, merge=True)
    return get_ui_preferences(database, user_id)


def save_visibility(
    database: SqlClient,
    user_id: str,
    target: str,
    visible: bool,
    page: str | None = None,
) -> dict[str, Any]:
    if not target or len(target) > 100:
        raise ValueError("Invalid visibility target.")
    if "<" in target or ">" in target:
        raise ValueError("Target must not contain < or >.")
    validated_page = _validate_page(page)
    raw = load_raw(database, user_id)
    if not raw:
        raw = {"version": 1, "global_tokens": {}, "global_css": "", "pages": {}, "history": []}
    _push_history(raw, f"visibility:{validated_page or 'global'}:{target}")
    pages = dict(raw.get("pages", {}))
    scope = validated_page or "__global_visibility__"
    entry = dict(pages.get(scope, {}))
    vis = dict(entry.get("visibility", {}))
    vis[target] = bool(visible)
    entry["visibility"] = vis
    pages[scope] = entry
    raw["pages"] = pages
    raw["version"] = int(raw.get("version", 1)) + 1
    raw["updated_at"] = _utc_now()
    _reference(database, user_id).set(
        {
            "version": raw["version"],
            "global_tokens": raw.get("global_tokens", {}),
            "global_css": raw.get("global_css", ""),
            "pages": raw.get("pages", {}),
            "history": raw.get("history", []),
            "updated_at": SERVER_TIMESTAMP,
        },
        merge=True,
    )
    return get_ui_preferences(database, user_id)


def reset_preferences(
    database: SqlClient,
    user_id: str,
    page: str | None = None,
    version: int | None = None,
) -> dict[str, Any]:
    raw = load_raw(database, user_id)
    if not raw:
        return get_ui_preferences(database, user_id)
    validated_page = _validate_page(page) if page else None
    if version is not None:
        # restore to historical version snapshot
        history = raw.get("history", [])
        found = next((h for h in history if int(h.get("version", 0)) == int(version)), None)
        if not found:
            raise ValueError(f"Version {version} not found in history.")
        snap = found.get("snapshot", {})
        _push_history(raw, f"restore:v{version}")
        raw["global_tokens"] = dict(snap.get("global_tokens", {}))
        raw["global_css"] = snap.get("global_css", "")
        raw["pages"] = dict(snap.get("pages", {}))
        raw["version"] = int(raw.get("version", 1)) + 1
        raw["updated_at"] = _utc_now()
        _reference(database, user_id).set(
            {
                "version": raw["version"],
                "global_tokens": raw["global_tokens"],
                "global_css": raw["global_css"],
                "pages": raw["pages"],
                "history": raw.get("history", []),
                "updated_at": SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return get_ui_preferences(database, user_id)
    if validated_page is None:
        _push_history(raw, "reset:global")
        raw["global_tokens"] = {}
        raw["global_css"] = ""
        # keep pages but caller asked global reset — we clear global only
        # if they want per-page, validated_page is set
        raw["version"] = int(raw.get("version", 1)) + 1
        raw["updated_at"] = _utc_now()
        _reference(database, user_id).set(
            {
                "version": raw["version"],
                "global_tokens": {},
                "global_css": "",
                "pages": raw.get("pages", {}),
                "history": raw.get("history", []),
                "updated_at": SERVER_TIMESTAMP,
            },
            merge=True,
        )
        return get_ui_preferences(database, user_id)
    # per-page reset
    _push_history(raw, f"reset:{validated_page}")
    pages = dict(raw.get("pages", {}))
    if validated_page in pages:
        pages.pop(validated_page, None)
    # also handle global visibility sentinel if page was sentinel
    raw["pages"] = pages
    raw["version"] = int(raw.get("version", 1)) + 1
    raw["updated_at"] = _utc_now()
    _reference(database, user_id).set(
        {
            "version": raw["version"],
            "global_tokens": raw.get("global_tokens", {}),
            "global_css": raw.get("global_css", ""),
            "pages": raw.get("pages", {}),
            "history": raw.get("history", []),
            "updated_at": SERVER_TIMESTAMP,
        },
        merge=True,
    )
    return get_ui_preferences(database, user_id)


def clear_all(database: SqlClient, user_id: str) -> dict[str, Any]:
    _reference(database, user_id).set(
        {
            "version": 1,
            "global_tokens": {},
            "global_css": "",
            "pages": {},
            "history": [],
            "updated_at": SERVER_TIMESTAMP,
        },
        merge=True,
    )
    return get_ui_preferences(database, user_id)
