"""Base WebSocket manager — reusable for calls and WhatsApp.

Single source for WS connect/disconnect/broadcast logic.
Policy "single" overwrites previous socket (calls), "multi" keeps set (WhatsApp).
"""

import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class BaseWSManager:
    def __init__(self, policy: str = "multi") -> None:
        if policy not in ("single", "multi"):
            raise ValueError("policy must be 'single' or 'multi'")
        self.policy = policy
        # single: dict[str, WebSocket]; multi: dict[str, set[WebSocket]]
        self._single: dict[str, WebSocket] = {}
        self._multi: dict[str, set[WebSocket]] = {}

    @property
    def _connections(self) -> dict:  # backward compat for tests
        if self.policy == "single":
            return self._single
        return self._multi

    async def connect(self, uid: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if self.policy == "single":
            self._single[uid] = websocket
            logger.debug("WS connect single: uid=%s total=%d", uid, len(self._single))
        else:
            self._multi.setdefault(uid, set()).add(websocket)
            logger.debug("WS connect multi: uid=%s sockets=%d", uid, len(self._multi[uid]))

    def disconnect(self, uid: str, websocket: WebSocket | None = None) -> None:
        if self.policy == "single":
            # only remove if same socket still mapped
            if self._single.get(uid) is websocket or websocket is None:
                self._single.pop(uid, None)
            logger.debug("WS disconnect single: uid=%s total=%d", uid, len(self._single))
        else:
            if uid in self._multi:
                if websocket is None:
                    self._multi.pop(uid, None)
                else:
                    self._multi[uid].discard(websocket)
                    if not self._multi[uid]:
                        self._multi.pop(uid, None)
            logger.debug("WS disconnect multi: uid=%s", uid)

    async def send(self, uid: str, event: dict[str, Any]) -> None:
        """Send to a single user (single policy) or first socket."""
        if self.policy == "single":
            ws = self._single.get(uid)
            if ws is None:
                return
            try:
                await ws.send_json(event)
            except Exception:
                self.disconnect(uid, ws)
        else:
            await self.broadcast_to_user(uid, event)

    async def broadcast_to_user(self, uid: str, event: dict[str, Any]) -> None:
        if self.policy == "single":
            await self.send(uid, event)
            return
        sockets = list(self._multi.get(uid, []))
        for ws in sockets:
            try:
                await ws.send_json(event)
            except Exception:
                self.disconnect(uid, ws)
