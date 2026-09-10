import pytest
from app.services.whatsapp_autoreply.rules import match_keyword_rule, DEFAULT_KEYWORD_RULES
from app.services.whatsapp_autoreply.engine import has_assistant_mention, WhatsAppAutoReplyEngine


def test_match_keyword_rules():
    assert match_keyword_rule("help") is not None
    assert match_keyword_rule("HELP") is not None
    assert match_keyword_rule("!help") is not None
    assert match_keyword_rule("pricing") is not None
    assert match_keyword_rule("what are your plans?") is None  # exact mode
    assert match_keyword_rule("plans") is not None
    assert match_keyword_rule("hours") is not None
    assert match_keyword_rule("status") is not None
    assert match_keyword_rule("random conversation") is None


def test_has_assistant_mention():
    assert has_assistant_mention("Hey @Jarvis can you help?", "Jarvis") is True
    assert has_assistant_mention("Jarvis what is the time?", "Jarvis") is True
    assert has_assistant_mention("Hello Eve!", "Eve") is True
    assert has_assistant_mention("Hey @Eve", "Jarvis") is True  # fallback to @eve
    assert has_assistant_mention("Hello everyone in this group", "Jarvis") is False


@pytest.mark.asyncio
async def test_autoreply_engine_guards():
    # 1. Ignore self messages
    res_self = await WhatsAppAutoReplyEngine.process_incoming_message(
        None,
        {"user_id": "u1", "chat_id": "c1", "content": "hello", "is_from_me": True}
    )
    assert res_self["status"] == "ignored"

    # 2. Ignore empty content
    res_empty = await WhatsAppAutoReplyEngine.process_incoming_message(
        None,
        {"user_id": "u1", "chat_id": "c1", "content": "   ", "is_from_me": False}
    )
    assert res_empty["status"] == "ignored"

    # 3. In group chats without mention, ignore
    class FakeDb:
        def collection(self, *args):
            return self
        def document(self, *args):
            return self
        def get(self):
            class Snap:
                exists = True
                id = "u1"
                def to_dict(self):
                    return {"assistant_name": "Jarvis"}
            return Snap()

    res_group = await WhatsAppAutoReplyEngine.process_incoming_message(
        FakeDb(),
        {
            "user_id": "u1",
            "chat_id": "group123@g.us",
            "content": "Hello team",
            "is_from_me": False,
            "is_group": True,
        }
    )
    assert res_group["status"] == "ignored"
    assert "without assistant mention" in res_group["reason"]


@pytest.mark.asyncio
async def test_autoreply_engine_keyword_reply(monkeypatch):
    class FakeDb:
        def collection(self, *args):
            return self
        def document(self, *args):
            return self
        def get(self):
            class Snap:
                exists = True
                id = "u1"
                def to_dict(self):
                    return {"assistant_name": "Jarvis"}
            return Snap()

    dispatched = {}

    async def fake_dispatch(database, user_id, chat_id, assistant_name, reply_text, tier):
        dispatched["user_id"] = user_id
        dispatched["chat_id"] = chat_id
        dispatched["assistant_name"] = assistant_name
        dispatched["reply_text"] = reply_text
        dispatched["tier"] = tier
        return {"status": "sent", "tier": tier}

    monkeypatch.setattr(WhatsAppAutoReplyEngine, "_dispatch_reply", fake_dispatch)

    # 1-on-1 direct chat: keyword "pricing" triggers instant tier 1 reply
    res = await WhatsAppAutoReplyEngine.process_incoming_message(
        FakeDb(),
        {
            "user_id": "u1",
            "chat_id": "direct_contact_123",
            "content": "pricing",
            "sender_name": "Alice",
            "is_from_me": False,
            "is_group": False,
        }
    )
    assert res["status"] == "sent"
    assert dispatched["tier"] == "keyword_rule"
    assert "StarWaves Plans & Pricing" in dispatched["reply_text"]
    assert dispatched["assistant_name"] == "Jarvis"

    # Immediate second message is debounced
    res_debounce = await WhatsAppAutoReplyEngine.process_incoming_message(
        FakeDb(),
        {
            "user_id": "u1",
            "chat_id": "direct_contact_123",
            "content": "help",
            "sender_name": "Alice",
            "is_from_me": False,
            "is_group": False,
        }
    )
    assert res_debounce["status"] == "debounced"

