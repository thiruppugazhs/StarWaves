#!/usr/bin/env python3
"""List all live models across OpenAI / Anthropic / Gemini / Groq / OpenRouter.

Uses the same endpoints the backend hits — see app/services/ai_models/unified.py.

Usage:
  OPENROUTER_API_KEY=... OPENAI_API_KEY=... python scripts/list_models.py
  python scripts/list_models.py --free-only --output modalities
  python scripts/list_models.py --provider openrouter --json > models.json

Env: loads server/.env automatically (same as app.core.config).
"""

import argparse
import asyncio
import json
import os
import sys

# Ensure server/ is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.prod"))

# Also respect shell env
from app.services.ai_models.unified import discover_all_models


def _fmt_row(m: dict) -> str:
    pricing = m.get("pricing")
    price_str = "-"
    if pricing:
        try:
            p = pricing.get("prompt", "?")
            c = pricing.get("completion", "?")
            price_str = f"{p}/{c}"
        except Exception:
            price_str = str(pricing)[:40]
    ctx = m.get("context_window") or "-"
    mods_in = ",".join(m.get("input_modalities") or [])
    mods_out = ",".join(m.get("output_modalities") or [])
    flags = []
    if m.get("supports_tts"):
        flags.append("TTS")
    if m.get("supports_stt"):
        flags.append("STT")
    if m.get("supports_image"):
        flags.append("IMG")
    if m.get("supports_streaming"):
        flags.append("stream")
    if m.get("is_free"):
        flags.append("FREE")
    flag_str = ",".join(flags) or "-"
    return f"{m['provider']:12} {m['id']:48} {str(ctx):>8}  {mods_in:12} -> {mods_out:12}  {flag_str:18} {price_str}"


async def main() -> None:
    parser = argparse.ArgumentParser(description="Unified live model discovery")
    parser.add_argument("--provider", help="Filter to one provider (openai, groq, openrouter, gemini, anthropic)")
    parser.add_argument("--free-only", action="store_true", help="Only pricing=0 models (e.g. fish-audio/s2.1-pro-free:free)")
    parser.add_argument("--tts", action="store_true", help="Only TTS (speech output) models")
    parser.add_argument("--stt", action="store_true", help="Only STT (audio input) models")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of table")
    parser.add_argument("--limit", type=int, default=0, help="Cap rows")
    args = parser.parse_args()

    # Build user_keys from env for local run (server also reads Firestore user keys when called via API)
    user_keys: dict[str, str] = {}
    for prov, env in [
        ("openai", "OPENAI_API_KEY"),
        ("anthropic", "ANTHROPIC_API_KEY"),
        ("gemini", "GEMINI_API_KEY"),
        ("openrouter", "OPENROUTER_API_KEY"),
        ("groq", "GROQ_API_KEY"),
        ("opencode", "OPENCODE_API_KEY"),
        ("ollama", "OLLAMA_API_KEY"),
    ]:
        val = os.getenv(env)
        if val:
            user_keys[prov] = val

    if not user_keys:
        print("No API keys found in env (OPENAI_API_KEY / OPENROUTER_API_KEY / GROQ_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY).", file=sys.stderr)
        print("Set at least one, or run via the live API: GET /api/v1/models (uses server env + user Firestore keys).", file=sys.stderr)

    models = await discover_all_models(user_keys, include_free_only=args.free_only)

    if args.provider:
        models = [m for m in models if m["provider"] == args.provider]
    if args.tts:
        models = [m for m in models if m.get("supports_tts")]
    if args.stt:
        models = [m for m in models if m.get("supports_stt")]

    if args.limit and args.limit > 0:
        models = models[: args.limit]

    if args.json:
        print(json.dumps({"count": len(models), "models": models}, indent=2, default=str))
        return

    print(f"Unified models: {len(models)} (providers: {', '.join(sorted({m['provider'] for m in models})) or 'none'})")
    print(f"{'PROVIDER':12} {'MODEL ID':48} {'CTX':>8}  {'INPUT':12} -> {'OUTPUT':12}  {'FLAGS':18} PRICING")
    print("-" * 140)
    for m in models:
        print(_fmt_row(m))
    print("\nFlags: TTS=speech output, STT=audio input, IMG=image, stream=streaming, FREE=pricing 0")
    print("API: GET /api/v1/models?free_only=true  |  GET /api/v1/models?tts=true  |  GET /api/v1/models/openrouter")


if __name__ == "__main__":
    asyncio.run(main())
