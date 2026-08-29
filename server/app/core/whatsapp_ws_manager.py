"""WhatsApp WS manager — facade over BaseWSManager (multi-tab)."""

from app.core.ws.base import BaseWSManager


class WhatsAppWSManager(BaseWSManager):
    def __init__(self) -> None:
        super().__init__(policy="multi")


whatsapp_ws_manager = WhatsAppWSManager()
