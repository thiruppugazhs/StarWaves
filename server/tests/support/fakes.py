"""Fake objects shared across tests — Firestore snapshots and scripted AI providers."""

from unittest.mock import MagicMock

from app.services.ai_models.contracts import (
    AiConfig,
    ProviderClient,
    ProviderResponse,
    StreamChunk,
    ToolCall,
)


class FakeFirestoreDoc:
    """Snapshot-like object mimicking a Firestore document snapshot."""

    def __init__(self, doc_id: str, data: dict | None, exists: bool = True):
        self.id = doc_id
        self._data = data or {}
        self.exists = exists

    def to_dict(self):
        return dict(self._data)


def make_mock_db() -> MagicMock:
    """Fresh MagicMock standing in for a Firestore client (legacy mocked-mode tests)."""
    return MagicMock()


def stub_collection_chain(db: MagicMock) -> MagicMock:
    """Configure ``db`` so collection().document().collection() returns one mock collection."""
    collection = MagicMock()
    db.collection.return_value.document.return_value.collection.return_value = collection
    return collection


def text_round(parts: list[str], tool_calls: list[ToolCall] | None = None) -> list[StreamChunk]:
    """Build one scripted streaming round: deltas followed by a final response."""
    chunks = [StreamChunk(kind="text_delta", text=part) for part in parts]
    chunks.append(
        StreamChunk(
            kind="final",
            response=ProviderResponse(text="".join(parts) or None, tool_calls=tool_calls or []),
        )
    )
    return chunks


class ScriptedProvider(ProviderClient):
    """Blocking provider that replays scripted ``ProviderResponse`` rounds."""

    def __init__(self, rounds: list[ProviderResponse]):
        self.rounds = list(rounds)
        self.round_index = 0
        self.calls: list[dict] = []

    def build_client(self, client_options):
        return MagicMock()

    def normalize_messages(self, messages):
        return list(messages)

    def call(self, model, instructions, conversation, tools):
        self.calls.append(
            {"model": model, "instructions": instructions, "conversation": conversation}
        )
        script = self.rounds[min(self.round_index, len(self.rounds) - 1)]
        self.round_index += 1
        return script

    def call_stream(self, model, instructions, conversation, tools):
        response = self.call(model, instructions, conversation, tools)
        yield from text_round([response.text] if response.text else [], tool_calls=response.tool_calls)

    def continuation(self, response):
        return [{"role": "assistant", "content": response.text or ""}]

    def tool_result_blocks(self, call: ToolCall, output):
        return [{"role": "user", "content": f"tool:{call.name}:{output}"}]


class StreamingScriptedProvider(ScriptedProvider):
    """Streaming provider yielding delta-by-delta from scripted rounds."""

    def __init__(self, rounds: list[list[StreamChunk]]):
        self.rounds = list(rounds)
        self.round_index = 0
        self.calls: list[dict] = []

    def call(self, model, instructions, conversation, tools):
        raise NotImplementedError("StreamingScriptedProvider only supports call_stream")

    def call_stream(self, model, instructions, conversation, tools):
        self.calls.append(
            {"model": model, "instructions": instructions, "conversation": conversation}
        )
        script = self.rounds[min(self.round_index, len(self.rounds) - 1)]
        self.round_index += 1
        yield from script


def simple_config(provider: str = "openai", model: str = "test-model") -> AiConfig:
    return AiConfig(provider=provider, model=model, client_options={})
