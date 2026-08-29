"""Usage routes — AI token usage summary and logs."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.cache import CACHE_TTL_LONG, cached
from app.core.dependencies import CurrentUserId, DbClient
from app.db.session import sync_engine
from app.repositories import usage as usage_repo

router = APIRouter(prefix="/usage", tags=["usage"])


def _sync_session():
    from sqlalchemy.orm import Session

    with Session(sync_engine) as s:
        yield s


@router.get("/summary")
@cached(ttl=CACHE_TTL_LONG, prefix="usage:summary")
def get_usage_summary(
    user_id: CurrentUserId,
    days: int | None = Query(default=None, ge=1, le=365, description="Filter last N days"),
):
    from sqlalchemy.orm import Session

    with Session(sync_engine) as session:
        data = usage_repo.get_summary(session, user_id, days=days)
        return data


@router.get("/logs")
@cached(ttl=CACHE_TTL_LONG, prefix="usage:logs")
def get_usage_logs(
    user_id: CurrentUserId,
    limit: int = Query(default=50, ge=1, le=200),
    provider: str | None = None,
    days: int | None = Query(default=None, ge=1, le=365),
):
    from sqlalchemy.orm import Session

    with Session(sync_engine) as session:
        rows = usage_repo.list_usage(session, user_id, limit=limit, provider=provider, days=days)
        return [
            {
                "id": r.id,
                "provider": r.provider,
                "model": r.model,
                "kind": r.kind,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "total_tokens": r.total_tokens,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ]
