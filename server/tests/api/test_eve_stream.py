import json
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.db import get_firestore
from app.services.ai_models.contracts import (
    AIServiceError,
    AiConfig,
    ProviderClient,
    ProviderResponse,
    StreamChunk,
    ToolCall,
)
from app.services.ai_models.loop import run_tool_loop_stream

mock_user = {"uid": "test-user-123", "email": "test@example.com"}
mock_db = MagicMock()

client = TestClient(app)


class FakeStreamProvider(ProviderClient):
    """Scripted provider: yields deltas then a final response per round."""

    def __init__(self, rounds):
        self.rounds = list(rounds)
        self.round_index = 0

    def build_client(self, client_options):
        return MagicMock()

    def normalize_messages(self, messages):
        return list(messages)

    def call(self, model, instructions, conversation, tools):
        raise NotImplementedError

    def call_stream(self, model, instructions, conversation, tools):
        script = self.rounds[min(self.round_index, len(self.rounds) - 1)]
        self.round_index += 1
        yield from script

    def continuation(self, response):
        return [{"role": "assistant", "content": response.text or ""}]

    def tool_result_blocks(self, call, output):
        return [{"role": "user", "content": f"tool:{call.name}:{output}"}]


def _text_round(text_parts, tool_calls=None):
    chunks = [StreamChunk(kind="text_delta", text=part) for part in text_parts]
    chunks.append(
        StreamChunk(
            kind="final",
            response=ProviderResponse(text="".join(text_parts) or None, tool_calls=tool_calls or []),
        )
    )
    return chunks


class TestRunToolLoopStream(unittest.TestCase):
    def _config(self):
        return AiConfig(provider="openai", model="test-model", client_options={})

    def test_yields_deltas_tools_then_done(self):
        provider = FakeStreamProvider([
            _text_round(["Searching", " workspace…"], tool_calls=[
                ToolCall(call_id="c1", name="search_workspace_records", arguments={"query": "x"}),
            ]),
            _text_round(["Here is ", "your answer."]),
        ])
        executed = []

        def run_tool(name, arguments):
            executed.append((name, arguments))
            return {"results": []}, "todos", None

        events = list(run_tool_loop_stream(
            provider,
            self._config(),
            "instructions",
            [{"role": "user", "content": "hi"}],
            [],
            run_tool,
        ))

        kinds = [event["type"] for event in events]
        self.assertEqual(
            kinds,
            [
                "delta", "delta",
                "tool_start", "tool_end",
                "delta", "delta",
                "done",
            ],
        )
        self.assertEqual(executed, [("search_workspace_records", {"query": "x"})])
        done = events[-1]
        self.assertEqual(done["message"], "Here is your answer.")
        self.assertEqual(done["changed_resources"], ["todos"])
        self.assertEqual(done["actions"], [])

    def test_done_without_tool_calls_returns_text(self):
        provider = FakeStreamProvider([_text_round(["Just text."])])

        events = list(run_tool_loop_stream(
            provider,
            self._config(),
            "instructions",
            [{"role": "user", "content": "hi"}],
            [],
            lambda name, arguments: ({}, None, None),
        ))

        self.assertEqual([event["type"] for event in events], ["delta", "done"])
        self.assertEqual(events[-1]["message"], "Just text.")

    def test_exceeding_max_tool_rounds_raises(self):
        endless_tool_call = ToolCall(call_id="c", name="loop_forever", arguments={})
        provider = FakeStreamProvider([
            _text_round([], tool_calls=[endless_tool_call]),
        ])

        with self.assertRaises(AIServiceError):
            list(run_tool_loop_stream(
                provider,
                self._config(),
                "instructions",
                [{"role": "user", "content": "hi"}],
                [],
                lambda name, arguments: ({}, None, None),
            ))


class TestEveChatStreamEndpoint(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._saved_current_user = app.dependency_overrides.get(get_current_user)
        self._saved_firestore = app.dependency_overrides.get(get_firestore)
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_firestore] = lambda: mock_db

    def tearDown(self):
        if self._saved_current_user is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = self._saved_current_user
        if self._saved_firestore is None:
            app.dependency_overrides.pop(get_firestore, None)
        else:
            app.dependency_overrides[get_firestore] = self._saved_firestore

    def test_streams_sse_frames_and_terminates_with_done_marker(self):
        def fake_stream(database, user, messages, session_id=None):
            yield {"type": "delta", "text": "Hello"}
            yield {"type": "delta", "text": " there."}
            yield {
                "type": "done",
                "message": "Hello there.",
                "changed_resources": [],
                "actions": [],
                "session_id": "sess-1",
            }

        with patch("app.api.routes.eve_stream.stream_chat_with_eve", side_effect=fake_stream):
            response = client.post(
                "/api/v1/eve/chat/stream",
                json={"messages": [{"role": "user", "content": "Hi Eve"}], "session_id": None},
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers["content-type"])
        self.assertEqual(response.headers["x-accel-buffering"], "no")
        frames = [
            line[len("data: "):]
            for line in response.text.split("\n\n")
            if line.startswith("data: ")
        ]
        self.assertEqual(frames[-1], "[DONE]")
        events = [json.loads(frame) for frame in frames[:-1]]
        self.assertEqual(events[0], {"type": "delta", "text": "Hello"})
        self.assertEqual(events[-1]["type"], "done")
        self.assertEqual(events[-1]["session_id"], "sess-1")

    def test_in_band_error_frame_on_stream_failure(self):
        def failing_stream(database, user, messages, session_id=None):
            yield {"type": "delta", "text": "Par"}
            raise RuntimeError("provider exploded")

        with patch("app.api.routes.eve_stream.stream_chat_with_eve", side_effect=failing_stream):
            response = client.post(
                "/api/v1/eve/chat/stream",
                json={"messages": [{"role": "user", "content": "Hi Eve"}]},
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn('"type": "error"', response.text.replace('": "', '": "'))
        self.assertTrue(response.text.rstrip().endswith("[DONE]"))


if __name__ == "__main__":
    unittest.main()
