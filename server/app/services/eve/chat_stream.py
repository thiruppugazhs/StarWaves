"""Eve chat streaming orchestrator — single responsibility: SSE event generator
over the provider tool loop with session persistence."""

import logging
from collections.abc import Iterator
from typing import Any

from app.db import SqlClient

from app.repositories import eve_sessions
from app.services.ai_models import any_provider_available, run_tool_loop_stream
from app.services.eve.auto_memory import extract_and_save_memories
from app.services.eve.chat_context import resolve_chat_context
from app.services.eve.tools import EVE_TOOLS

logger = logging.getLogger(__name__)


def stream_chat_with_eve(
    database: SqlClient,
    user: dict,
    messages: list[dict[str, str]],
    session_id: str | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield streaming events for an Eve chat turn.

    Event contract (JSON-serializable dicts):
    - {"type": "delta", "text": str}
    - {"type": "tool_start", "name": str} / {"type": "tool_end", "name": str}
    - {"type": "done", "message": str, "changed_resources": [...], "actions": [...], "session_id": str}
    - {"type": "error", "detail": str}

    The session is persisted only after a successful completion; when the
    request carries no session_id a new session is created and its id is
    returned inside the done event.
    """
    user_id = user.get("uid")
    if not any_provider_available():
        logger.error(f"[Eve Chat Stream] Chat request rejected: No AI provider configured on server or in user settings for user {user_id}")
        yield {
            "type": "error",
            "detail": "Eve is not configured. Add an AI provider API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY) on the server, or configure a provider key in Settings > AI Models.",
        }
        return

    if session_id:
        try:
            eve_sessions.get_session(database, user_id, session_id)
        except ValueError as error:
            logger.warning(f"[Eve Chat Stream] Session '{session_id}' not found for user {user_id}: {error}")
            yield {"type": "error", "detail": str(error)}
            return

    context = resolve_chat_context(database, user_id, messages)

    done_event: dict[str, Any] | None = None
    try:
        for event in run_tool_loop_stream(
            context.client,
            context.config,
            context.instructions,
            context.conversation,
            EVE_TOOLS,
            context.run_tool,
            usage_user_id=user_id,
            usage_kind="chat",
        ):
            if event.get("type") == "done":
                done_event = dict(event)
            else:
                yield event
    except Exception as error:
        logger.error(
            f"[Eve Chat Stream] Stream failed with provider='{context.config.provider}', model='{context.config.model}' for user {user_id}: {type(error).__name__}: {error}",
            exc_info=True,
        )
        yield {
            "type": "error",
            "detail": f"Eve AI service error ({context.config.provider}/{context.config.model}): {error}",
        }
        return

    if done_event is None:
        return

    # Persist session AFTER success; auto-create when the request had no session.
    assistant_reply = done_event["message"]
    history = [
        {"role": entry["role"], "content": entry["content"]}
        for entry in messages
    ] + [{"role": "assistant", "content": assistant_reply}]
    persisted_session_id = session_id
    try:
        if session_id:
            eve_sessions.save_messages(database, user_id, session_id, history)
        else:
            created = eve_sessions.create_session(database, user_id, history)
            persisted_session_id = created["id"]
    except Exception as persist_error:
        logger.error(f"[Eve Chat Stream] Session persistence failed for user {user_id}: {persist_error}", exc_info=True)

    # Auto-remember before the done event so extraction always runs (the route
    # consumes the generator fully, but this keeps it deterministic).
    extract_and_save_memories(database, user, messages, assistant_reply)

    done_event["session_id"] = persisted_session_id
    yield done_event
