"""Deepgram STT transcriber tests — mocked httpx, no network."""

import unittest
from unittest.mock import MagicMock, patch

from app.services.speech import SpeechServiceError
from app.services.speech import deepgram


def _fake_response(status_code=200, transcript="Hello from Deepgram"):
    response = MagicMock()
    response.status_code = status_code
    if status_code >= 400:
        response.text = "boom"
        response.json.side_effect = ValueError("no json")
    else:
        response.json.return_value = {
            "results": {
                "channels": [
                    {"alternatives": [{"transcript": transcript}]}
                ]
            }
        }
    return response


class TestDeepgramTranscriber(unittest.TestCase):
    def setUp(self):
        # Settings is a frozen dataclass; patch the module-level reference with
        # a stub carrying test values instead of mutating the singleton.
        self._patcher = patch.object(
            deepgram,
            "settings",
            MagicMock(
                deepgram_api_key="test-key",
                deepgram_stt_url="https://api.deepgram.com/v1/listen",
                deepgram_stt_model="nova-3",
            ),
        )
        self._patcher.start()
        self.addCleanup(self._patcher.stop)

    def test_parses_transcript_from_first_alternative(self):
        with patch("app.services.speech.deepgram.httpx.post", return_value=_fake_response()) as mock_post:
            text = deepgram.transcribe_audio_deepgram(b"audio-bytes", "audio/webm", "en-US", "nova-3")
        self.assertEqual(text, "Hello from Deepgram")
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["params"]["model"], "nova-3")
        self.assertEqual(kwargs["params"]["language"], "en-US")
        self.assertTrue(kwargs["headers"]["Authorization"].startswith("Token "))
        self.assertEqual(kwargs["headers"]["Content-Type"], "audio/webm")

    def test_defaults_model_and_content_type(self):
        with patch("app.services.speech.deepgram.httpx.post", return_value=_fake_response()) as mock_post:
            deepgram.transcribe_audio_deepgram(b"abc", None, None, None)
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["params"]["model"], "nova-3")
        self.assertEqual(kwargs["headers"]["Content-Type"], "audio/wav")
        self.assertNotIn("language", kwargs["params"])

    def test_raises_on_http_error(self):
        with patch("app.services.speech.deepgram.httpx.post", return_value=_fake_response(status_code=401)):
            with self.assertRaises(SpeechServiceError):
                deepgram.transcribe_audio_deepgram(b"abc", "audio/webm", None, "nova-3")

    def test_raises_on_empty_transcript(self):
        with patch("app.services.speech.deepgram.httpx.post", return_value=_fake_response(transcript="")):
            with self.assertRaises(SpeechServiceError):
                deepgram.transcribe_audio_deepgram(b"abc", "audio/webm", None, "nova-3")

    def test_raises_on_empty_audio(self):
        with self.assertRaises(SpeechServiceError):
            deepgram.transcribe_audio_deepgram(b"", "audio/webm", None, "nova-3")

    def test_raises_on_unknown_model(self):
        with self.assertRaises(SpeechServiceError):
            deepgram.transcribe_audio_deepgram(b"abc", "audio/webm", None, "does-not-exist")


if __name__ == "__main__":
    unittest.main()
