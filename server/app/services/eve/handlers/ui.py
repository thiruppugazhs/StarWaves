"""UI handlers — single responsibility: Eve-driven UI customization execution."""

from app.db import SqlClient
from app.services.ui_preferences import (
    clear_all,
    get_ui_preferences,
    reset_preferences,
    save_css,
    save_tokens,
    save_visibility,
)

# simple in-memory custom page store — persisted via ui-preferences pages.custom:<slug>
_CUSTOM_PAGE_RE = __import__("re").compile(r"^[a-z0-9-]+$")


def _action(preferences: dict) -> dict:
    return {"type": "apply_ui_overrides", "preferences": preferences}


def handle_get_ui_state(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    prefs = get_ui_preferences(database, user_id)
    page = arguments.get("page")
    if page:
        # filter to page if requested
        pages = prefs.get("pages", {})
        filtered = pages.get(page)
        return {"preferences": prefs, "requested_page": page, "page_snapshot": filtered}, None, None
    return {"preferences": prefs}, None, None


def handle_update_ui_theme(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, dict]:
    tokens = arguments.get("tokens") or {}
    if not isinstance(tokens, dict) or not tokens:
        raise ValueError("tokens must be a non-empty object.")
    page = arguments.get("page")
    reason = arguments.get("reason")
    prefs = save_tokens(database, user_id, tokens, page, reason)
    return {"updated": True, "preferences": prefs, "tokens": tokens, "page": page}, "ui-preferences", _action(prefs)


def handle_update_ui_styles(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, dict]:
    css = arguments.get("css")
    if not isinstance(css, str) or not css.strip():
        raise ValueError("css must be a non-empty string.")
    page = arguments.get("page")
    prefs = save_css(database, user_id, css, page)
    return {"updated": True, "preferences": prefs, "page": page}, "ui-preferences", _action(prefs)


def handle_manage_ui_visibility(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, dict]:
    target = arguments.get("target")
    visible = arguments.get("visible")
    if not isinstance(target, str) or not target.strip():
        raise ValueError("target must be a non-empty string.")
    if not isinstance(visible, bool):
        raise ValueError("visible must be a boolean.")
    page = arguments.get("page")
    prefs = save_visibility(database, user_id, target.strip(), visible, page)
    return {"updated": True, "preferences": prefs, "target": target, "visible": visible}, "ui-preferences", _action(prefs)


def handle_reset_ui(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, dict]:
    page = arguments.get("page")
    version = arguments.get("version")
    if version is not None and page is not None:
        raise ValueError("Provide either page or version, not both.")
    if version is not None:
        prefs = reset_preferences(database, user_id, None, int(version))
        return {"reset": True, "restored_version": version, "preferences": prefs}, "ui-preferences", {"type": "reset_ui", "preferences": prefs}
    if page:
        prefs = reset_preferences(database, user_id, page, None)
        return {"reset": True, "page": page, "preferences": prefs}, "ui-preferences", {"type": "reset_ui", "preferences": prefs}
    # global reset
    prefs = clear_all(database, user_id)
    return {"reset": True, "preferences": prefs}, "ui-preferences", {"type": "reset_ui", "preferences": prefs}


def handle_list_ui_history(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, None, None]:
    prefs = get_ui_preferences(database, user_id)
    return {"history": prefs.get("history", []), "current_version": prefs.get("version", 1)}, None, None


def handle_create_custom_page(database: SqlClient, user_id: str, arguments: dict) -> tuple[dict, str, dict]:
    slug = (arguments.get("slug") or "").strip().lower()
    title = (arguments.get("title") or "").strip()
    desc = (arguments.get("description") or "").strip()
    code = arguments.get("code")
    if not slug or not _CUSTOM_PAGE_RE.match(slug):
        raise ValueError("slug must match ^[a-z0-9-]+$")
    if len(slug) > 40:
        raise ValueError("slug too long (max 40).")
    if not title:
        raise ValueError("title is required.")
    if not desc:
        raise ValueError("description is required.")
    # Persist as a page entry in ui-preferences so it survives restarts
    prefs = get_ui_preferences(database, user_id)
    pages = dict(prefs.get("pages", {}))
    key = f"custom:{slug}"
    if key in pages and pages[key].get("type") == "custom_page":
        raise ValueError(f"Custom page '{slug}' already exists. Choose a different slug or reset_ui for that page.")
    starter = code.strip() if isinstance(code, str) and code.strip() else f"""export function Custom{slug.replace('-', ' ').title().replace(' ', '')}Page() {{
  return (
    <div style={{ padding: 24 }}>
      <h1>{title}</h1>
      <p>{desc}</p>
      <p>Customize this page via Eve: "edit my {slug} page to ..."</p>
    </div>
  )
}}"""
    # store via save_tokens path — use a dedicated custom page entry
    from app.services.ui_preferences import load_raw, _reference
    from app.db import SERVER_TIMESTAMP
    import datetime, timezone

    raw = load_raw(database, user_id)
    if not raw:
        raw = {"version": 1, "global_tokens": {}, "global_css": "", "pages": {}, "history": []}
    # push history
    from app.services.ui_preferences import _push_history, _utc_now

    _push_history(raw, f"create_custom_page:{slug}")
    pages = dict(raw.get("pages", {}))
    pages[key] = {"type": "custom_page", "title": title, "description": desc, "code": starter[:8000], "created_at": _utc_now()}
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
    prefs = get_ui_preferences(database, user_id)
    return (
        {"created": True, "slug": slug, "title": title, "path": f"/custom/{slug}", "preferences": prefs},
        "ui-preferences",
        {"type": "open_custom_page", "slug": slug, "preferences": prefs},
    )
