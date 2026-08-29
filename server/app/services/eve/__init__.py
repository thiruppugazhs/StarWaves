"""Eve service package — facade re-exporting the public API for backward compatibility.

Implementation is split into single-responsibility modules:
- instructions, tools/* (per-domain catalogs), memories, chat_context,
  dispatcher, handlers/* (per-domain), chat, chat_stream, auto_memory
"""

from app.services.eve.auto_memory import extract_and_save_memories
from app.services.eve.chat import chat_with_eve
from app.services.eve.chat_stream import stream_chat_with_eve
from app.services.eve.constants import (
    MAX_RECORDS_PER_READ,
    SUPPORTED_RESOURCES,
    WORKSPACE_PAGES,
    WRITABLE_RESOURCES,
)
from app.services.eve.dispatcher import dispatch_tool as _run_tool
from app.services.eve.dispatcher import dispatch_tool
from app.services.eve.instructions import EVE_INSTRUCTIONS
from app.services.eve.memories import build_memory_instructions, invalidate_memories_cache
from app.services.eve.memory_settings import (
    EVE_MEMORY_SETTINGS_DOC,
    load_memory_settings,
    resolve_auto_remember,
)
from app.services.eve.tools import EVE_TOOLS
from app.services.eve.workspace_records import (
    delete_workspace_record,
    restore_workspace_record,
)

__all__ = [
    "EVE_INSTRUCTIONS",
    "EVE_MEMORY_SETTINGS_DOC",
    "EVE_TOOLS",
    "MAX_RECORDS_PER_READ",
    "SUPPORTED_RESOURCES",
    "WRITABLE_RESOURCES",
    "WORKSPACE_PAGES",
    "_run_tool",
    "build_memory_instructions",
    "chat_with_eve",
    "delete_workspace_record",
    "dispatch_tool",
    "extract_and_save_memories",
    "invalidate_memories_cache",
    "load_memory_settings",
    "resolve_auto_remember",
    "restore_workspace_record",
    "stream_chat_with_eve",
]
