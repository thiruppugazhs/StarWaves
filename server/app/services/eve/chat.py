"""Eve chat orchestrator — single responsibility: LLM tool loop and session management."""

import logging
from typing import Any

from fastapi import HTTPException, status
from app.db import SqlClient

from app.repositories import eve_sessions
from app.services.ai_models import AIServiceError, PROVIDER_CLIENTS, any_provider_available, has_server_key, run_tool_loop
from app.services.ai_models.config import build_ai_config
from app.services.eve.auto_memory import extract_and_save_memories
from app.services.eve.chat_context import resolve_chat_context
from app.services.eve.tools import EVE_TOOLS

_FALLBACK_ORDER = ["openrouter", "openai", "anthropic", "gemini", "groq", "ollama", "opencode"]

logger = logging.getLogger(__name__)

def chat_with_eve(
    database: SqlClient,
    user: dict,
    messages: list[dict[str, str]],
    session_id: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    editor_context: dict[str, Any] | None = None,
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

    try:
        if provider or model:
            context = resolve_chat_context(database, user_id, messages, provider, model, editor_context)
        else:
            context = resolve_chat_context(database, user_id, messages, editor_context=editor_context)
    except AIServiceError as error:
        logger.error(f"[Eve Chat] AI config error for user {user_id}: {error}", exc_info=True)
        code = getattr(error, "status_code", 502)
        headers = {"Retry-After": str(error.retry_after)} if getattr(error, "retry_after", None) else None
        raise HTTPException(
            status_code=code,
            detail=f"Eve AI service error: {error}",
            headers=headers,
        ) from error
    except Exception as error:
        logger.error(f"[Eve Chat] Unexpected config error for user {user_id}: {type(error).__name__}: {error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Eve chat error: {type(error).__name__}: {error}",
        ) from error

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
        # Fallback for transient server/quota errors — try next available provider once
        if error.kind in ("server", "quota"):
            fallback_success = False
            # For quota, first try same provider with default/free model before switching provider
            if error.kind == "quota":
                try:
                    default_config = build_ai_config(context.config.provider, None)
                    if default_config.model != context.config.model and has_server_key(default_config.provider):
                        fallback_client = PROVIDER_CLIENTS[default_config.provider](default_config.client_options)
                        logger.warning(
                            f"[Eve Chat] Quota fallback {context.config.provider}/{context.config.model} -> "
                            f"{default_config.provider}/{default_config.model} (same provider default)"
                        )
                        message, changed_resources, actions = run_tool_loop(
                            fallback_client,
                            default_config,
                            context.instructions,
                            context.conversation,
                            EVE_TOOLS,
                            context.run_tool,
                            usage_user_id=user_id,
                            usage_kind="chat",
                        )
                        fallback_success = True
                except Exception as fb_err:
                    logger.warning(f"[Eve Chat] Same-provider fallback failed: {fb_err}")
                if not fallback_success and context.config.provider == "openrouter" and context.config.model != "openrouter/free":
                    try:
                        if has_server_key("openrouter"):
                            free_config = build_ai_config("openrouter", "openrouter/free")
                            fallback_client = PROVIDER_CLIENTS["openrouter"](free_config.client_options)
                            logger.warning(f"[Eve Chat] Quota fallback to openrouter/free after {error}")
                            message, changed_resources, actions = run_tool_loop(
                                fallback_client,
                                free_config,
                                context.instructions,
                                context.conversation,
                                EVE_TOOLS,
                                context.run_tool,
                                usage_user_id=user_id,
                                usage_kind="chat",
                            )
                            fallback_success = True
                    except Exception as fb_err:
                        logger.warning(f"[Eve Chat] openrouter/free fallback failed: {fb_err}")
            if not fallback_success:
                for fallback_provider in _FALLBACK_ORDER:
                    if fallback_provider == context.config.provider:
                        continue
                    if not has_server_key(fallback_provider):
                        continue
                    try:
                        fallback_config = build_ai_config(fallback_provider, None)
                        fallback_client = PROVIDER_CLIENTS[fallback_provider](fallback_config.client_options)
                        logger.warning(
                            f"[Eve Chat] Fallback {context.config.provider}/{context.config.model} -> "
                            f"{fallback_provider}/{fallback_config.model} after {error.kind}: {error}"
                        )
                        message, changed_resources, actions = run_tool_loop(
                            fallback_client,
                            fallback_config,
                            context.instructions,
                            context.conversation,
                            EVE_TOOLS,
                            context.run_tool,
                            usage_user_id=user_id,
                            usage_kind="chat",
                        )
                        fallback_success = True
                        break
                    except Exception as fb_err:
                        logger.warning(f"[Eve Chat] Fallback {fallback_provider} failed: {fb_err}")
                        continue
            if fallback_success:
                pass
            else:
                code = getattr(error, "status_code", 502)
                headers = {"Retry-After": str(error.retry_after)} if getattr(error, "retry_after", None) else None
                raise HTTPException(
                    status_code=code,
                    detail=f"Eve AI service error ({context.config.provider}/{context.config.model}): {error}",
                    headers=headers,
                ) from error
        else:
            code = getattr(error, "status_code", 502)
            headers = {"Retry-After": str(error.retry_after)} if getattr(error, "retry_after", None) else None
            raise HTTPException(
                status_code=code,
                detail=f"Eve AI service error ({context.config.provider}/{context.config.model}): {error}",
                headers=headers,
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
