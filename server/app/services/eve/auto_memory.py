"""Auto-remember — single responsibility: extract durable facts from AI exchanges
and persist them as Eve memories.

Runs after a successful ``chat_with_eve`` reply for every AI surface (chat, WhatsApp
auto-replies, scheduled prompts, voice calls) when the user's auto-remember toggle
is ON. One bounded extraction LLM call per turn; failures are logged and swallowed —
memory capture must never break the chat itself.
"""

import json
import logging
import re

from app.db import SqlClient

from app.repositories.eve import add_memory, list_memories
from app.services.ai_models import PROVIDER_CLIENTS, resolve_ai_config
from app.services.eve.memory_settings import resolve_auto_remember

logger = logging.getLogger(__name__)

MAX_EXTRACTED_MEMORIES = 3
MAX_MEMORY_CHARS = 500
MAX_CONTEXT_CHARS = 2000
_DEDUPE_RECENT = 100

EXTRACTION_INSTRUCTIONS = (
    "You extract long-term memories about the user from a conversation exchange. "
    f"Return ONLY a JSON array of at most {MAX_EXTRACTED_MEMORIES} short strings. "
    "Each string is one durable fact worth remembering across future conversations: "
    "preferences, identity, ongoing projects, tech stack, commitments, corrections "
    "about you (Eve). Exclude small talk, transient questions, and anything already "
    "obvious from the reply itself. If nothing durable appears, return []."
)


def _exchange_text(messages: list[dict[str, str]], reply: str) -> tuple[str, str]:
    """Last user message + assistant reply, each truncated."""
    user_text = next(
        (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
        "",
    )
    return user_text[:MAX_CONTEXT_CHARS], (reply or "")[:MAX_CONTEXT_CHARS]


def _parse_facts(raw: str | None) -> list[str]:
    """Parse the model output into validated memory strings."""
    if not raw:
        return []
    text = raw.strip()
    # Strip markdown fences if present
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    facts: list[str] = []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            facts = [str(item) for item in parsed]
    except Exception:
        # Fallback: pull double-quoted strings
        facts = re.findall(r'"([^"\n]{4,})"', text)
    cleaned: list[str] = []
    for fact in facts:
        fact = fact.strip()
        if not fact:
            continue
        if len(fact) > MAX_MEMORY_CHARS:
            fact = fact[:MAX_MEMORY_CHARS]
        cleaned.append(fact)
    return cleaned[:MAX_EXTRACTED_MEMORIES]


def _is_duplicate(fact: str, existing: list[dict]) -> bool:
    lowered = fact.lower()
    for memory in existing:
        content = (memory.get("content") or "").lower().strip()
        if not content:
            continue
        if lowered == content or lowered in content or content in lowered:
            return True
    return False


def extract_and_save_memories(
    database: SqlClient,
    user: dict,
    messages: list[dict[str, str]],
    reply: str,
) -> list[str]:
    """Extract 0-3 durable facts from the exchange and save them as memories.

    Returns the list of saved memory contents (empty when disabled/nothing found).
    Never raises — logs and returns [] on any failure.
    """
    user_id = user.get("uid")
    try:
        if not resolve_auto_remember(database, user_id):
            return []

        user_text, reply_text = _exchange_text(messages, reply)
        if not user_text.strip():
            return []

        config = resolve_ai_config(database, user_id)
        client = PROVIDER_CLIENTS[config.provider](config.client_options)
        conversation = [
            {
                "role": "user",
                "content": (
                    f"User said:\n{user_text}\n\nEve replied:\n{reply_text}\n\n"
                    "Extract durable memories now."
                ),
            }
        ]
        response = client.call(
            model=config.model,
            instructions=EXTRACTION_INSTRUCTIONS,
            conversation=conversation,
            tools=[],
        )
        facts = _parse_facts(response.text)
        if not facts:
            return []

        existing = list_memories(database, user_id, limit=_DEDUPE_RECENT)
        saved: list[str] = []
        for fact in facts:
            if _is_duplicate(fact, existing):
                continue
            add_memory(database, user_id, fact)
            saved.append(fact)
            existing.append({"content": fact})
        if saved:
            logger.info(
                "[Eve Auto-Remember] Saved %d memory(ies) for user %s",
                len(saved),
                user_id,
            )
        return saved
    except Exception as error:
        logger.warning("[Eve Auto-Remember] Extraction failed for %s: %s", user_id, error)
        return []
