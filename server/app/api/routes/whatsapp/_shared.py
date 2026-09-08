"""Shared helpers for WhatsApp routes — mention detection and chat resolution."""

from app.repositories import whatsapp as whatsapp_repo


def has_eve_mention(content: str, user_settings) -> bool:
    text_lower = (content or "").lower()
    eve_tag = (user_settings.eve_tag or "@eve").lower()
    owner_aliases = [a.lower().strip() for a in (user_settings.owner_aliases or ["@susindran", "@susin"]) if a.strip()]
    keywords = [k.lower().strip() for k in (user_settings.keywords or ["@eve", "eve"]) if k.strip()]
    return (
        eve_tag in text_lower
        or "@eve" in text_lower
        or any(alias in text_lower for alias in owner_aliases)
        or any(kw in text_lower for kw in keywords)
        or text_lower.startswith("eve ")
        or text_lower == "eve"
    )


def resolve_chat_name(chat_id: str, chat_name: str | None, is_group: bool, is_from_me: bool, sender_name: str | None, existing) -> str:
    resolved = chat_name
    if not resolved or resolved in ("Contact", "Group conversation", chat_id, "You"):
        if is_group:
            resolved = existing.name if (existing and existing.name and existing.name not in ("Contact", chat_id)) else "Group conversation"
        else:
            if not is_from_me and sender_name and sender_name not in ("You", "Contact"):
                resolved = sender_name
            elif existing and existing.name and existing.name not in ("Contact", "Group conversation", chat_id, "You"):
                resolved = existing.name
            else:
                clean = chat_id.replace("@s.whatsapp.net", "").replace("@g.us", "")
                resolved = f"+{clean}" if clean.isdigit() else clean
    if existing and existing.name and existing.name not in ("Contact", "Group conversation", chat_id, "You") and (not chat_name or chat_name in ("Contact", "Group conversation", chat_id, "You")):
        resolved = existing.name
    return resolved
