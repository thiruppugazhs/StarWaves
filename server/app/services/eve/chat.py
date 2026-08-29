"""Eve chat orchestrator — single responsibility: LLM tool loop and session management."""

import logging
from typing import Any

from fastapi import HTTPException, status
from app.db import SqlClient

from app.repositories import eve_sessions
from app.services.ai_models import AIServiceError, any_provider_available, run_tool_loop
from app.services.eve.auto_memory import extract_and_save_memories
from app.services.eve.chat_context import resolve_chat_context
from app.services.eve.tools import EVE_TOOLS

logger = logging.getLogger(__name__)

def chat_with_eve(
    database: SqlClient,
    user: dict,
    messages: list[dict[str, str]],
    session_id: str | None = None,
) -> tuple[str, list[str], list[dict[str, Any]]]:
    user_id = user.get("uid")
    if not any_provider_available():
        logger.error(f"[Eve Chat] Chat request rejected: No AI provider configured on server or in user settings for user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Eve is not configured. Add an AI provider API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY) on the server, or configure a provider key in Settings > AI Models.",
        )

    if session_id:
        try:
            eve_sessions.get_session(database, user_id, session_id)
        except ValueError as error:
            logger.warning(f"[Eve Chat] Session '{session_id}' not found for user {user_id}: {error}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    context = resolve_chat_context(database, user_id, messages)

    try:
        message, changed_resources, actions = run_tool_loop(
            context.client,
            context.config,
            context.instructions,
            context.conversation,
            EVE_TOOLS,
            context.run_tool,
            usage_user_id=user_id,
            usage_kind="chat",
        )
    except AIServiceError as error:
        logger.error(
            f"[Eve Chat] AI service error with provider='{context.config.provider}', model='{context.config.model}' for user {user_id}: {error}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Eve AI service error ({context.config.provider}/{context.config.model}): {error}",
        ) from error
    except Exception as error:
        logger.error(
            f"[Eve Chat] Unexpected execution error with provider='{context.config.provider}', model='{context.config.model}' for user {user_id}: {type(error).__name__}: {error}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Eve chat error ({context.config.provider}/{context.config.model}): {type(error).__name__}: {error}",
        ) from error

    if session_id:
        eve_sessions.save_messages(
            database,
            user["uid"],
            session_id,
            [
                {"role": entry["role"], "content": entry["content"]}
                for entry in messages
            ]
            + [{"role": "assistant", "content": message}],
        )

    # Auto-remember: capture durable facts from this exchange when enabled.
    # Covers every AI surface funneling through chat_with_eve (chat, WhatsApp
    # auto-replies, scheduled prompts, voice calls). Never raises.
    extract_and_save_memories(database, user, messages, message)
    return message, changed_resources, actions
