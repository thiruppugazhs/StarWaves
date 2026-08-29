"""Embeddings service for Eve memory semantic recall.

Uses OpenAI text-embedding-3-small (1536 dims, cheap, ~$0.02/1M tokens) via same
OPENAI_API_KEY / OPENAI_URL as chat. Falls back to NO-OP if no key (e2-micro 1-10 users).
Lean for 1-10 users: embeddings cached nowhere (pgvector stores them), generation is sync
wrapped in to_thread by callers so single worker stays responsive.
"""

from typing import Any

from app.core.config import settings

EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536


def is_embedding_available() -> bool:
    return bool(settings.openai_api_key)


def _get_openai_client() -> Any | None:
    if not is_embedding_available():
        return None
    try:
        from openai import OpenAI  # type: ignore

        kwargs: dict[str, Any] = {"api_key": settings.openai_api_key}
        if settings.openai_url:
            # OPENAI_URL may be https://ollama.com/v1 — embeddings not available there, skip
            if "ollama" in settings.openai_url:
                return None
            kwargs["base_url"] = settings.openai_url
        return OpenAI(**kwargs)
    except Exception:
        return None


def generate_embedding(text: str) -> list[float] | None:
    """Generate 1536-dim embedding for text. Returns None if unavailable or on error."""
    if not text or not text.strip():
        return None
    client = _get_openai_client()
    if client is None:
        return None
    try:
        # truncate to ~8000 chars to stay under token limit (8191)
        truncated = text.strip()[:8000]
        resp = client.embeddings.create(model=EMBED_MODEL, input=truncated)
        emb = resp.data[0].embedding  # type: ignore
        if len(emb) != EMBED_DIM:
            # ollama or alt provider may return different dim — pad/truncate safely
            if len(emb) > EMBED_DIM:
                emb = emb[:EMBED_DIM]
            elif len(emb) < EMBED_DIM:
                emb = emb + [0.0] * (EMBED_DIM - len(emb))
        return emb
    except Exception:
        return None


def generate_embedding_sync(text: str) -> list[float] | None:
    """Sync wrapper for to_thread usage."""
    return generate_embedding(text)
