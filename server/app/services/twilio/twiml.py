"""TwiML builders — Eve AI voice and human handoff."""

import html


def _escape(text: str) -> str:
    return html.escape(text or "")


def build_eve_twiml(message: str, voice: str = "alice", language: str = "en-US", gather: bool = True) -> str:
    """Eve answers via <Say> then <Gather> for barge-in (speech input).

    Gather posts to /gather-fast (fast model path, targets <1s reply)."""
    safe = _escape(message[:1600] or "Hello, this is Eve from StarWaves. How can I help you today?")
    if gather:
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{voice}" language="{language}">{safe}</Say>
    <Gather input="speech" speechTimeout="auto" language="{language}" action="/api/v1/calls/twilio/gather-fast" method="POST">
        <Say voice="{voice}" language="{language}">You can speak after the tone.</Say>
    </Gather>
    <Say voice="{voice}" language="{language}">I didn't catch that. Goodbye.</Say>
    <Hangup/>
</Response>"""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{voice}" language="{language}">{safe}</Say>
    <Pause length="1"/>
    <Hangup/>
</Response>"""


def build_human_twiml(say_text: str | None = None, dial_number: str | None = None) -> str:
    """Human-to-human PSTN: optionally Say then Dial with status callback."""
    parts = ['<?xml version="1.0" encoding="UTF-8"?>\n<Response>']
    if say_text:
        parts.append(f'    <Say voice="alice">{_escape(say_text)}</Say>')
    if dial_number:
        parts.append(f'    <Dial callerId="true" answerOnBridge="true">{_escape(dial_number)}</Dial>')
    else:
        parts.append('    <Pause length="1"/>')
        parts.append('    <Hangup/>')
    parts.append('</Response>')
    return "\n".join(parts)


def build_echo_twiml(text: str) -> str:
    safe = _escape(text[:500])
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">You said: {safe}</Say>
    <Hangup/>
</Response>"""


def build_relay_twiml(relay_url: str, greeting: str | None = None, voice: str = "en-US-Neural2-F", language: str = "en-US") -> str:
    """ConversationRelay TwiML — WebSocket media session.

    Twilio opens a WebSocket to ``relay_url`` and handles STT + TTS itself;
    our server streams plain-text tokens over JSON. Enables ~1s turns and
    barge-in (interrupt events) versus blocking <Gather> round-trips.
    """
    greeting_attr = f' greeting="{_escape(greeting[:400])}"' if greeting else ""
    safe_url = _escape(relay_url)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <ConversationRelay url="{safe_url}"{greeting_attr} voice="{voice}" language="{language}" />
    </Connect>
</Response>"""


def split_text_tokens(text: str, max_chars: int = 40) -> list[str]:
    """Split reply text into small token chunks for ConversationRelay streaming.

    Word-boundary chunks (<= max_chars) so Twilio TTS can start speaking the
    first words while later chunks are still being generated/sent.
    """
    words = (text or "").split()
    if not words:
        return []
    tokens: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > max_chars and current:
            tokens.append(current)
            current = word
        else:
            current = candidate
    if current:
        tokens.append(current)
    return tokens
