"""WhatsApp auto-reply rules and keyword matching engine."""

import re
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class AutoReplyRule:
    name: str
    keywords: List[str]
    response_template: str
    match_mode: str = "contains"  # "exact", "starts_with", "contains"
    enabled: bool = True


DEFAULT_KEYWORD_RULES: List[AutoReplyRule] = [
    AutoReplyRule(
        name="help",
        keywords=["help", "menu", "!help", "/help", "commands"],
        match_mode="exact",
        response_template=(
            "👋 Hi {sender_name}! I am {assistant_name}, your personal AI assistant on WhatsApp.\n\n"
            "Here are some things I can do for you:\n"
            "• Ask me any question or ask me to draft a message\n"
            "• Type *pricing* to view available plans\n"
            "• Type *hours* to check working hours & availability\n"
            "• Type *support* to contact our team\n"
            "• Type *status* to check assistant status\n\n"
            "Feel free to chat with me anytime!"
        ),
    ),
    AutoReplyRule(
        name="pricing",
        keywords=["pricing", "cost", "plans", "price", "subscription"],
        match_mode="exact",
        response_template=(
            "💳 *StarWaves Plans & Pricing*:\n\n"
            "• *Free Tier*: Basic AI assistance, workspace access, and standard messaging.\n"
            "• *Pro Tier*: Custom assistant naming, advanced models (GPT-4o, Claude 3.5, Gemini 2.5), unlimited WhatsApp auto-replies, and voice features.\n\n"
            "Visit your StarWaves dashboard Settings to upgrade your plan."
        ),
    ),
    AutoReplyRule(
        name="hours",
        keywords=["hours", "timing", "timings", "availability", "schedule"],
        match_mode="exact",
        response_template=(
            "🕒 *Hours of Availability*:\n\n"
            "• *{assistant_name} AI*: Available 24/7/365 right here on WhatsApp.\n"
            "• *Human Support Team*: Monday – Friday, 9:00 AM – 6:00 PM IST.\n\n"
            "You can message here anytime, and we'll ensure you get a response!"
        ),
    ),
    AutoReplyRule(
        name="contact",
        keywords=["contact", "support", "human", "agent", "call"],
        match_mode="exact",
        response_template=(
            "📞 *Contact & Support*:\n\n"
            "Need help from our team?\n"
            "• Email: support@starwaves.app\n"
            "• Web: Visit the Help & Support section on your dashboard\n\n"
            "I have noted your message and a team member will follow up if required."
        ),
    ),
    AutoReplyRule(
        name="status",
        keywords=["status", "ping", "!status", "health"],
        match_mode="exact",
        response_template=(
            "⚡ *Status Check*:\n\n"
            "• Assistant: {assistant_name} AI is Online ✅\n"
            "• WhatsApp Worker: Connected ✅\n"
            "• Auto-Reply Server: Active 🚀"
        ),
    ),
]


def match_keyword_rule(
    text: str,
    rules: Optional[List[AutoReplyRule]] = None,
) -> Optional[AutoReplyRule]:
    """Matches text against keyword rules. Returns the first matched rule, or None."""
    if not text:
        return None

    active_rules = rules if rules is not None else DEFAULT_KEYWORD_RULES
    clean_text = text.strip().lower()
    # Normalize punctuation for comparison
    normalized = re.sub(r"[^\w\s]", "", clean_text).strip()

    for rule in active_rules:
        if not rule.enabled:
            continue

        for kw in rule.keywords:
            kw_clean = kw.lower().strip()
            kw_normalized = re.sub(r"[^\w\s]", "", kw_clean).strip()

            if rule.match_mode == "exact":
                # Check exact match or normalized single-word match
                if clean_text == kw_clean or normalized == kw_normalized:
                    return rule
            elif rule.match_mode == "starts_with":
                if clean_text.startswith(kw_clean) or normalized.startswith(kw_normalized):
                    return rule
            elif rule.match_mode == "contains":
                pattern = r"\b" + re.escape(kw_clean) + r"\b"
                if re.search(pattern, clean_text):
                    return rule

    return None
