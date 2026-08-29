"""Service for AI usage logging and aggregation — business logic + heuristics."""

from typing import Any

from sqlalchemy.orm import Session

from app.db.session import sync_engine
from app.repositories import usage as usage_repo


def _estimate_tokens(text: str | None) -> int:
    if not text:
        return 0
    # rough heuristic ~4 chars per token if no provider usage available
    return max(1, len(text) // 4)


def extract_usage_from_response(raw: Any, fallback_text: str | None = None) -> tuple[int, int, int]:
    """Try to extract prompt/completion/total from provider raw response; fallback to heuristic."""
    try:
        if raw is None:
            est = _estimate_tokens(fallback_text)
            return est, 0, est
        # OpenAI responses API: raw.usage = {input_tokens, output_tokens, total_tokens} or prompt_tokens/completion_tokens
        usage = getattr(raw, "usage", None)
        if usage is not None:
            if isinstance(usage, dict):
                p = usage.get("prompt_tokens") or usage.get("input_tokens") or usage.get("inputTokens") or 0
                c = usage.get("completion_tokens") or usage.get("output_tokens") or usage.get("outputTokens") or 0
                t = usage.get("total_tokens") or usage.get("totalTokens") or (p + c)
                if t:
                    return int(p), int(c), int(t)
            else:
                p = getattr(usage, "prompt_tokens", None) or getattr(usage, "input_tokens", None) or 0
                c = getattr(usage, "completion_tokens", None) or getattr(usage, "output_tokens", None) or 0
                t = getattr(usage, "total_tokens", None) or getattr(usage, "total_tokens", None) or (p + c)
                # Some SDKs use input_tokens/output_tokens
                if not p and hasattr(usage, "input_tokens"):
                    p = usage.input_tokens
                if not c and hasattr(usage, "output_tokens"):
                    c = usage.output_tokens
                if p or c or t:
                    return int(p or 0), int(c or 0), int(t or (p + c))
        # Anthropic/Gemini: raw.usage or raw.usageMetadata
        for attr in ("usage", "usageMetadata", "usage_metadata"):
            u = getattr(raw, attr, None)
            if u:
                return extract_usage_from_response(u, fallback_text)
        # If dict response
        if isinstance(raw, dict):
            u = raw.get("usage") or raw.get("usageMetadata")
            if u:
                return extract_usage_from_response(u, fallback_text)
    except Exception:
        pass
    est = _estimate_tokens(fallback_text)
    return est, 0, est


def log_usage(
    user_id: str,
    provider: str,
    model: str,
    kind: str,
    raw: Any,
    fallback_text: str | None = None,
) -> None:
    """Persist one usage record; never raises."""
    try:
        prompt, completion, total = extract_usage_from_response(raw, fallback_text)
        from sqlalchemy.orm import Session

        with Session(sync_engine) as session:
            usage_repo.create_usage(session, user_id, provider, model, kind, prompt, completion, total)
    except Exception:
        pass
