"""Eve chat streaming orchestrator - single responsibility: SSE event generator
over the provider tool loop with session persistence."""

import logging
import threading
import time
from collections.abc import Iterator
from typing import Any

from app.db import SqlClient

from app.repositories import eve_sessions
from app.services.ai_models import PROVIDER_CLIENTS, any_provider_available, has_server_key, run_tool_loop_stream
from app.services.ai_models.config import build_ai_config
from app.services.eve.auto_memory import extract_and_save_memories
from app.services.eve.chat_context import resolve_chat_context
from app.services.eve.tools import EVE_TOOLS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Session-ID validation cache (P3) -- avoids a DB read on every continuation
# turn. Keyed by user_id -> set of known-valid session IDs with expiry.
# Max 20 entries per user, 5-minute TTL.
# ---------------------------------------------------------------------------
_SESSION_CACHE_TTL = 300  # 5 minutes
_MAX_SESSION_CACHE = 20
_session_cache: dict[str, tuple[float, set[str]]] = {}  # user_id -> (expiry, ids)


def _session_cache_has(user_id: str, session_id: str) -> bool:
    entry = _session_cache.get(user_id)
    if entry and entry[0] > time.monotonic() and session_id in entry[1]:
        return True
    return False


def _session_cache_add(user_id: str, session_id: str) -> None:
    entry = _session_cache.get(user_id)
    now = time.monotonic()
    if entry and entry[0] > now:
        ids = entry[1]
        if len(ids) >= _MAX_SESSION_CACHE:
            ids.pop()  # evict arbitrary entry when full
        ids.add(session_id)
        _session_cache[user_id] = (entry[0], ids)
    else:
        _session_cache[user_id] = (now + _SESSION_CACHE_TTL, {session_id})


_FALLBACK_ORDER = ["openrouter", "openai", "anthropic", "gemini", "groq", "ollama", "opencode"]


def stream_chat_with_eve(
    database: SqlClient,
    user: dict,
    messages: list[dict[str, str]],
    session_id: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    editor_context: dict[str, Any] | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield streaming events for an Eve chat turn.

    Event contract (JSON-serializable dicts):
    - {type: delta, text: str}
    - {type: tool_start, name: str} / {type: tool_end, name: str}
    - {type: done, message: str, changed_resources: [...], actions: [...], session_id: str}
    - {type: error, detail: str}

    The session is persisted only after a successful completion; when the
    request carries no session_id a new session is created and its id is
    returned inside the done event.
    """
    user_id = user.get("uid")
    if not any_provider_available():
        logger.error(
            "[Eve Chat Stream] Chat request rejected: No AI provider configured "
            "on server or in user settings for user %s", user_id
        )
        yield {
            "type": "error",
            "detail": (
                "Eve is not configured. Add an AI provider API key "
                "(OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY) on the "
                "server, or configure a provider key in Settings > AI Models."
            ),
        }
        return

    # P3: Skip the DB read for session validation on continuation turns using
    # a short-lived in-memory cache of known-valid session IDs.
    if session_id:
        if _session_cache_has(user_id, session_id):
            pass  # cache hit -- skip DB read
        else:
            try:
                eve_sessions.get_session(database, user_id, session_id)
                _session_cache_add(user_id, session_id)
            except ValueError as error:
                logger.warning(
                    "[Eve Chat Stream] Session '%s' not found for user %s: %s",
                    session_id, user_id, error,
                )
                yield {"type": "error", "detail": str(error)}
                return

    try:
        context = resolve_chat_context(database, user_id, messages, provider, model, editor_context)
    except Exception as error:
        logger.error(
            "[Eve Chat Stream] AI config error for user %s: %s: %s",
            user_id, type(error).__name__, error, exc_info=True,
        )
        kind = getattr(error, "kind", "provider_error")
        code = getattr(error, "status_code", 502)
        yield {
            "type": "error",
            "detail": f"Eve AI service error: {error}",
            "code": kind,
            "status": code,
            "retry_after": getattr(error, "retry_after", None),
        }
        return

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
            "[Eve Chat Stream] Stream failed with provider='%s', model='%s' for user %s: %s: %s",
            context.config.provider, context.config.model, user_id, type(error).__name__, error,
            exc_info=True,
        )
        kind = getattr(error, "kind", "provider_error")
        code = getattr(error, "status_code", 502)
        # Fallback for transient server/quota errors -- try next available provider once
        if kind in ("server", "quota"):
            fallback_done: dict[str, Any] | None = None
            # For quota, first try same provider with default/free model
            if kind == "quota":
                try:
                    default_config = build_ai_config(context.config.provider, None)
                    if default_config.model != context.config.model and has_server_key(default_config.provider):
                        fallback_client = PROVIDER_CLIENTS[default_config.provider](default_config.client_options)
                        logger.warning(
                            "[Eve Chat Stream] Quota fallback %s/%s -> %s/%s (same provider default)",
                            context.config.provider, context.config.model,
                            default_config.provider, default_config.model,
                        )
                        for fb_event in run_tool_loop_stream(
                            fallback_client, default_config,
                            context.instructions, context.conversation,
                            EVE_TOOLS, context.run_tool,
                            usage_user_id=user_id, usage_kind="chat",
                        ):
                            if fb_event.get("type") == "done":
                                fallback_done = dict(fb_event)
                            else:
                                yield fb_event
                        if fallback_done is not None:
                            done_event = fallback_done
                except Exception as fb_err:
                    logger.warning("[Eve Chat Stream] Same-provider fallback failed: %s", fb_err)
                if (
                    fallback_done is None
                    and context.config.provider == "openrouter"
                    and context.config.model != "openrouter/free"
                ):
                    try:
                        if has_server_key("openrouter"):
                            free_config = build_ai_config("openrouter", "openrouter/free")
                            fallback_client = PROVIDER_CLIENTS["openrouter"](free_config.client_options)
                            logger.warning("[Eve Chat Stream] Quota fallback to openrouter/free after %s", error)
                            for fb_event in run_tool_loop_stream(
                                fallback_client, free_config,
                                context.instructions, context.conversation,
                                EVE_TOOLS, context.run_tool,
                                usage_user_id=user_id, usage_kind="chat",
                            ):
                                if fb_event.get("type") == "done":
                                    fallback_done = dict(fb_event)
                                else:
                                    yield fb_event
                            if fallback_done is not None:
                                done_event = fallback_done
                    except Exception as fb_err:
                        logger.warning("[Eve Chat Stream] openrouter/free fallback failed: %s", fb_err)
            if fallback_done is None:
                for fallback_provider in _FALLBACK_ORDER:
                    if fallback_provider == context.config.provider:
                        continue
                    if not has_server_key(fallback_provider):
                        continue
                    try:
                        fallback_config = build_ai_config(fallback_provider, None)
                        fallback_client = PROVIDER_CLIENTS[fallback_provider](fallback_config.client_options)
                        logger.warning(
                            "[Eve Chat Stream] Fallback %s/%s -> %s/%s after %s: %s",
                            context.config.provider, context.config.model,
                            fallback_provider, fallback_config.model,
                            kind, error,
                        )
                        for fb_event in run_tool_loop_stream(
                            fallback_client, fallback_config,
                            context.instructions, context.conversation,
                            EVE_TOOLS, context.run_tool,
                            usage_user_id=user_id, usage_kind="chat",
                        ):
                            if fb_event.get("type") == "done":
                                fallback_done = dict(fb_event)
                            else:
                                yield fb_event
                        if fallback_done is not None:
                            done_event = fallback_done
                            break
                    except Exception as fb_err:
                        logger.warning("[Eve Chat Stream] Fallback %s failed: %s", fallback_provider, fb_err)
                        continue
            if done_event is not None:
                pass  # fallback succeeded -- continue to persistence
            else:
                yield {
                    "type": "error",
                    "detail": f"Eve AI service error ({context.config.provider}/{context.config.model}): {error}",
                    "code": kind,
                    "status": code,
                    "retry_after": getattr(error, "retry_after", None),
                }
                return
        else:
            yield {
                "type": "error",
                "detail": f"Eve AI service error ({context.config.provider}/{context.config.model}): {error}",
                "code": kind,
                "status": code,
                "retry_after": getattr(error, "retry_after", None),
            }
            return

    if done_event is None:
        return

    # Persist session AFTER success; auto-create when the request had no session.
    assistant_reply = done_event["message"]
    history = (
        [{"role": entry["role"], "content": entry["content"]} for entry in messages]
        + [{"role": "assistant", "content": assistant_reply}]
    )
    persisted_session_id = session_id
    try:
        if session_id:
            eve_sessions.save_messages(database, user_id, session_id, history)
            _session_cache_add(user_id, session_id)  # keep cache warm after save
        else:
            created = eve_sessions.create_session(database, user_id, history)
            persisted_session_id = created["id"]
            _session_cache_add(user_id, persisted_session_id)
    except Exception as persist_error:
        logger.error(
            "[Eve Chat Stream] Session persistence failed for user %s: %s",
            user_id, persist_error, exc_info=True,
        )

    done_event["session_id"] = persisted_session_id

    # P4/P5: Yield done to the client FIRST, then extract memories in a daemon
    # thread. This removes the full second LLM round-trip from user-visible
    # latency -- auto-remember is background housekeeping, not part of the response.
    yield done_event

    threading.Thread(
        target=extract_and_save_memories,
        args=(database, user, messages, assistant_reply),
        daemon=True,
    ).start()
