"""Eve chat context — single responsibility: build the shared per-turn inputs
(RAG instructions, resolved AI config, provider client, conversation) used by
both the blocking and streaming chat orchestrators."""

from dataclasses import dataclass
from typing import Any

from app.db import SqlClient

from app.services.ai_models import PROVIDER_CLIENTS, resolve_ai_config
from app.services.ai_models.contracts import AiConfig, ProviderClient
from app.services.eve.dispatcher import dispatch_tool
from app.services.eve.memories import build_memory_instructions


def last_user_query(messages: list[dict[str, str]]) -> str | None:
    """Return the most recent user message content, used as the RAG memory query."""
    return next((message["content"] for message in reversed(messages) if message.get("role") == "user"), None)


@dataclass
class ChatContext:
    """Everything an Eve orchestrator needs to run one tool loop."""

    database: SqlClient
    user_id: str
    instructions: str
    config: AiConfig
    client: ProviderClient
    conversation: list[dict[str, str]]

    def run_tool(self, name: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], str | None, dict[str, Any] | None]:
        return dispatch_tool(self.database, self.user_id, name, arguments)


def resolve_chat_context(
    database: SqlClient,
    user_id: str,
    messages: list[dict[str, str]],
    provider: str | None = None,
    model: str | None = None,
    editor_context: dict[str, Any] | None = None,
) -> ChatContext:
    """Build RAG memory instructions and resolve the user's AI provider client."""
    config = resolve_ai_config(database, user_id, provider_override=provider, model_override=model)
    instructions = build_memory_instructions(database, user_id, query=last_user_query(messages))
    if editor_context:
        import json
        bounded_context = json.dumps(editor_context, default=str)[:12000]
        instructions += (
            "\nThe user currently has Avatar Studio open. Use avatar_editor_action for editor changes. "
            "Never claim an editor action happened until the frontend confirms it. "
            f"Current editor context: {bounded_context}"
        )
    return ChatContext(
        database=database,
        user_id=user_id,
        instructions=instructions,
        config=config,
        client=PROVIDER_CLIENTS[config.provider](config.client_options),
        conversation=[{"role": message["role"], "content": message["content"]} for message in messages],
    )
