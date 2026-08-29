"""Cross-device sync helper — broadcasts invalidate/data-sync events via WhatsApp WS (multi)."""

from typing import Any

from app.core.whatsapp_ws_manager import whatsapp_ws_manager


async def broadcast_invalidate(user_id: str, scope: str, extra: dict[str, Any] | None = None) -> None:
    payload: dict[str, Any] = {"type": "sync_invalidate", "scope": scope}
    if extra:
        payload.update(extra)
    try:
        await whatsapp_ws_manager.broadcast_to_user(user_id, payload)
    except Exception:
        pass


async def broadcast_data_change(user_id: str, entity: str, action: str, entity_id: str | None = None) -> None:
    await broadcast_invalidate(user_id, entity, {"action": action, "id": entity_id})
