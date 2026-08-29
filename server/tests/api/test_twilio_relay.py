"""Twilio ConversationRelay tests — TwiML shape, token splitting, WS contract."""

import unittest
from unittest.mock import MagicMock, patch

from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient

from app.main import app
from app.services.ai_models.contracts import ProviderResponse, StreamChunk
from app.services.twilio.twiml import build_relay_twiml, split_text_tokens


class TestRelayTwiML(unittest.TestCase):
    def test_relay_twiml_contains_connect_and_url(self):
        xml = build_relay_twiml("wss://api.example.com/ws/twilio-relay?call_id=c1")
        self.assertIn("<Connect>", xml)
        self.assertIn("<ConversationRelay", xml)
        self.assertIn('url="wss://api.example.com/ws/twilio-relay?call_id=c1"', xml)
        self.assertIn("language=\"en-US\"", xml)

    def test_relay_twiml_includes_greeting_when_given(self):
        xml = build_relay_twiml("wss://x/y", greeting="Hello from Eve")
        self.assertIn('greeting="Hello from Eve"', xml)

    def test_relay_twiml_omits_greeting_when_absent(self):
        xml = build_relay_twiml("wss://x/y")
        self.assertNotIn("greeting=", xml)


class TestSplitTextTokens(unittest.TestCase):
    def test_splits_on_word_boundaries_under_limit(self):
        tokens = split_text_tokens("one two three four five six seven eight")
        self.assertTrue(all(len(t) <= 40 for t in tokens))
        self.assertEqual(" ".join(tokens), "one two three four five six seven eight")

    def test_empty_text_returns_no_tokens(self):
        self.assertEqual(split_text_tokens(""), [])
        self.assertEqual(split_text_tokens(None), [])

    def test_long_single_word_becomes_one_token(self):
        self.assertEqual(split_text_tokens("supercalifragilistic"), ["supercalifragilistic"])


def _fake_client(deltas=("Hello", " there!")):
    client = MagicMock()

    def stream(*args, **kwargs):
        for d in deltas:
            yield StreamChunk(kind="text_delta", text=d)
        yield StreamChunk(kind="final", response=ProviderResponse(text="Hello there!", tool_calls=[]))

    client.call_stream = stream
    return client


class TestRelayWebSocket(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        cfg = MagicMock(provider="groq", model="llama-3.1-8b-instant")
        patcher_cfg = patch("app.api.routes.twilio_relay.resolve_voice_config", return_value=cfg)
        patcher_client = patch("app.services.ai_models.get_provider_client", return_value=_fake_client())
        patcher_cfg.start()
        patcher_client.start()
        self.addCleanup(patcher_cfg.stop)
        self.addCleanup(patcher_client.stop)

    def _read_until_last(self, ws):
        frames = [ws.receive_json()]
        while not frames[-1].get("last"):
            frames.append(ws.receive_json())
        return frames

    def test_prompt_streams_token_frames_then_last(self):
        with self.client.websocket_connect("/ws/twilio-relay?call_id=none") as ws:
            ws.send_json({"type": "setup", "callSid": "CA1", "streamSid": "MZ1"})
            ws.send_json({"type": "prompt", "voicePrompt": "Hi Eve"})
            frames = self._read_until_last(ws)
        kinds = [(f["type"], f["last"]) for f in frames]
        self.assertEqual(kinds[-1], ("text", True))
        joined = "".join(f.get("token", "") for f in frames[:-1])
        self.assertEqual(joined, "Hello there!")

    def test_interrupt_then_disconnect_is_clean(self):
        with self.client.websocket_connect("/ws/twilio-relay?call_id=none") as ws:
            ws.send_json({"type": "setup"})
            ws.send_json({"type": "prompt", "voicePrompt": "Long question?"})
            # Drain one frame then barge-in; server must not crash.
            ws.receive_json()
            ws.send_json({"type": "interrupt"})

    def test_unknown_type_is_ignored(self):
        with self.client.websocket_connect("/ws/twilio-relay?call_id=none") as ws:
            ws.send_json({"type": "future-thing", "payload": {}})
            ws.send_json({"type": "prompt", "voicePrompt": "Hi"})
            frames = self._read_until_last(ws)
            self.assertTrue(frames[-1]["last"])


if __name__ == "__main__":
    unittest.main()
