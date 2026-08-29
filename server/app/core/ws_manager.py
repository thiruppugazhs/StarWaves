"""In-process WebSocket connection manager for call signaling — facade over BaseWSManager."""

from app.core.ws.base import BaseWSManager


class CallWSManager(BaseWSManager):
    def __init__(self) -> None:
        super().__init__(policy="multi")


# multi connection per user — ringing broadcasts to all devices (E)
call_ws_manager = CallWSManager()
