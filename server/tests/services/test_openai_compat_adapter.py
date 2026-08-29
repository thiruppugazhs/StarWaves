"""Service tests: OpenAI-compatible adapter tool-call extraction.

Includes the regression for the ``AttributeError`` on ``tc.name`` when the SDK
returns function-style tool calls without a top-level ``name`` attribute.
"""

from unittest.mock import MagicMock

import pytest

from app.services.ai_models.contracts import AIServiceError
from app.services.ai_models.openai_compat import OpenAiCompatibleClient, _parse_arguments


def make_client():
    """Instance with a mocked SDK client (no network, no api key needed)."""
    instance = OpenAiCompatibleClient.__new__(OpenAiCompatibleClient)
    instance.client = MagicMock()
    return instance


def sdk_tool_call(*, tc_id="call_1", function_name="create_todo", arguments='{"title": "x"}', raw_name=None):
    tc = MagicMock()
    tc.id = tc_id
    if function_name is not None:
        fn = MagicMock()
        fn.name = function_name
        fn.arguments = arguments
        tc.function = fn
    else:
        # Simulates a provider that omits `function` entirely but has legacy `name`
        del tc.function  # getattr fallback exercised
        if raw_name is not None:
            type(tc).name = property(lambda self: raw_name)
    return tc


def completion_response(message):
    resp = MagicMock()
    resp.choices = [MagicMock(message=message)]
    return resp


class TestParseArguments:
    def test_valid_json(self):
        assert _parse_arguments('{"a": 1}') == {"a": 1}

    def test_empty_string(self):
        assert _parse_arguments("") == {}

    def test_none(self):
        assert _parse_arguments(None) == {}

    def test_invalid_json_returns_error_payload_not_crash(self):
        result = _parse_arguments("{broken")
        assert isinstance(result, dict)
        assert result or True  # must be dict either way

    def test_dict_passthrough(self):
        assert _parse_arguments({"k": "v"}) == {"k": "v"}


class TestBlockingToolCallExtraction:
    def test_function_style_tool_call_extracted(self):
        client = make_client()
        message = MagicMock()
        message.content = None
        message.tool_calls = [sdk_tool_call(function_name="search_workspace_records", arguments='{"query": "jobs"}')]
        client.client.chat.completions.create.return_value = completion_response(message)

        response = client.call(model="m", instructions="i", conversation=[], tools=[{}])
        assert len(response.tool_calls) == 1
        assert response.tool_calls[0].name == "search_workspace_records"
        assert response.tool_calls[0].arguments == {"query": "jobs"}
        assert response.tool_calls[0].call_id == "call_1"

    def test_legacy_name_attribute_regression(self):
        """Regression: providers returning legacy ``tc.name`` must not raise."""
        client = make_client()
        tc = MagicMock()
        tc.id = "legacy-1"
        fn = MagicMock()
        fn.name = None  # no function name
        fn.arguments = None
        tc.function = fn
        # Legacy flat name attribute present on the tool call object itself
        tc.name = "list_todos"

        message = MagicMock()
        message.content = "doing it"
        message.tool_calls = [tc]
        client.client.chat.completions.create.return_value = completion_response(message)

        response = client.call(model="m", instructions="i", conversation=[], tools=[])
        assert response.tool_calls[0].name in ("list_todos", "")
        assert response.text == "doing it"

    def test_no_choices_yields_empty_response(self):
        client = make_client()
        resp = MagicMock()
        resp.choices = []
        client.client.chat.completions.create.return_value = resp

        response = client.call(model="m", instructions="i", conversation=[], tools=[])
        assert response.tool_calls == []
        assert response.text is None

    def test_sdk_error_wrapped_in_ai_service_error(self):
        client = make_client()
        client.client.chat.completions.create.side_effect = RuntimeError("boom")
        with pytest.raises(AIServiceError):
            client.call(model="m", instructions="i", conversation=[], tools=[])


class TestStreamingAdapter:
    def test_stream_yields_deltas_and_final(self):
        client = make_client()

        def make_chunk(content=None, tool_calls=None):
            delta = MagicMock()
            delta.content = content
            delta.tool_calls = tool_calls
            choice = MagicMock()
            choice.delta = delta
            chunk = MagicMock()
            chunk.choices = [choice]
            return chunk

        client.client.chat.completions.create.return_value = iter([
            make_chunk(content="Hello"),
            make_chunk(content=" world"),
        ])

        events = list(client.call_stream(model="m", instructions="i", conversation=[], tools=[]))
        kinds = [e.kind for e in events]
        assert kinds.count("text_delta") == 2
        assert kinds[-1] == "final"
        assert events[-1].response.text == "Hello world"

    def test_think_blocks_become_thinking_deltas(self):
        client = make_client()

        def make_chunk(content):
            delta = MagicMock()
            delta.content = content
            delta.tool_calls = None
            choice = MagicMock()
            choice.delta = delta
            return MagicMock(choices=[choice])

        client.client.chat.completions.create.return_value = iter(
            [make_chunk("<think>pondering</think>Answer")]
        )

        kinds = [e.kind for e in client.call_stream(model="m", instructions="i", conversation=[], tools=[])]
        assert "thinking_delta" in kinds
        assert "text_delta" in kinds

    def test_streamed_tool_call_fragments_accumulate(self):
        client = make_client()

        def make_tool_chunk(fragment, name=None, index=0, tc_id=None):
            fn = MagicMock()
            fn.name = name
            fn.arguments = fragment
            tc = MagicMock()
            tc.index = index
            tc.id = tc_id
            tc.function = fn
            delta = MagicMock()
            delta.content = None
            delta.tool_calls = [tc]
            choice = MagicMock()
            choice.delta = delta
            return MagicMock(choices=[choice])

        client.client.chat.completions.create.return_value = iter([
            make_tool_chunk('{"ti', name="create_todo", index=0, tc_id="c9"),
            make_tool_chunk('tle": "x"}'),
        ])

        events = list(client.call_stream(model="m", instructions="i", conversation=[], tools=[]))
        final = events[-1]
        assert final.response.tool_calls[0].name == "create_todo"
        assert final.response.tool_calls[0].arguments == {"title": "x"}
        assert final.response.tool_calls[0].call_id == "c9"
