"""Eve UI tools — single responsibility: UI customization domain."""

from app.services.eve.constants import WORKSPACE_PAGES

_WORKSPACE_PAGES_LIST = list(WORKSPACE_PAGES)

UI_TOOLS = [
    {
        "type": "function",
        "name": "get_ui_state",
        "description": "Read the current UI customization state: global tokens, global CSS, per-page overrides, visibility, and version history. Use before making edits to avoid overwriting.",
        "parameters": {
            "type": "object",
            "properties": {
                "page": {
                    "type": "string",
                    "description": f"Optional page to inspect. One of: {', '.join(_WORKSPACE_PAGES_LIST)} or custom:<slug>",
                }
            },
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "update_ui_theme",
        "description": "Update UI design tokens (colors, radii, spacing, shadows, fonts). Tokens are CSS variables like --bg-primary, --text-primary, --radius-lg, --font-family, --layout-gutter, --shadow-md. Monochrome is default; use color only when user explicitly requests it (e.g. 'make it blue'). Page param scopes to a single page, omit for global.",
        "parameters": {
            "type": "object",
            "properties": {
                "tokens": {
                    "type": "object",
                    "description": "Map of CSS variable to value, e.g. {\"--radius-lg\": \"24px\", \"--bg-primary\": \"#fafafa\"}. Only allowlisted tokens are accepted.",
                    "additionalProperties": {"type": "string"},
                },
                "page": {"type": "string", "description": "Optional page scope."},
                "reason": {"type": "string", "description": "Short reason for the change (for history)."},
            },
            "required": ["tokens"],
            "additionalProperties": False,
        },
        "strict": False,
    },
    {
        "type": "function",
        "name": "update_ui_styles",
        "description": "Inject freeform CSS for advanced styling. Use for effects beyond tokens (animations, gradients, layout tweaks). CSS is sanitized (blocks @import, javascript:, external urls, < >). Keep under 5000 chars. Prefer tokens when possible. Page param scopes to a page.",
        "parameters": {
            "type": "object",
            "properties": {
                "css": {"type": "string", "minLength": 1, "maxLength": 5000, "description": "CSS string to inject."},
                "page": {"type": "string", "description": "Optional page scope."},
            },
            "required": ["css"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "manage_ui_visibility",
        "description": "Show or hide a UI section. Target is a logical section id like 'sidebar', 'header', 'dashboard.metrics', 'projects.grid'. Use get_ui_state to discover current visibility. Page scopes to a page when relevant.",
        "parameters": {
            "type": "object",
            "properties": {
                "target": {"type": "string", "minLength": 1, "description": "Section target id."},
                "visible": {"type": "boolean", "description": "True to show, false to hide."},
                "page": {"type": "string", "description": "Optional page scope."},
            },
            "required": ["target", "visible"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "reset_ui",
        "description": "Reset UI customizations. Without page, resets global tokens+CSS. With page, resets only that page. With version, restores a historical version (use list_ui_history or get_ui_state to find version). Also serves as undo.",
        "parameters": {
            "type": "object",
            "properties": {
                "page": {"type": "string", "description": "Optional page to reset."},
                "version": {"type": "integer", "minimum": 1, "description": "Optional historical version to restore."},
            },
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "list_ui_history",
        "description": "List UI version history (last 20 versions) with version, timestamp, cause, and snapshot. Use to find a version to restore via reset_ui.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_custom_page",
        "description": "Create a new custom page/component. Generates a React page at /custom/<slug> with provided description and optional code. Slug must be lowercase alphanumeric with hyphens. Use when user wants a brand new page or widget.",
        "parameters": {
            "type": "object",
            "properties": {
                "slug": {"type": "string", "pattern": "^[a-z0-9-]+$", "description": "URL slug, e.g. 'my-dashboard'"},
                "title": {"type": "string", "minLength": 1, "maxLength": 80, "description": "Page title."},
                "description": {"type": "string", "minLength": 1, "maxLength": 500, "description": "What the page should do."},
                "code": {"type": "string", "description": "Optional React code for the page. If omitted, a starter template is used."},
            },
            "required": ["slug", "title", "description"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]
