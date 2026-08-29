"""Repository for AI token usage logs — thin data access, no business logic."""

from datetime import datetime, timezone, timedelta
from typing import Any

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.models import AiUsage


def create_usage(
    session: Session,
    user_id: str,
    provider: str,
    model: str,
    kind: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
) -> AiUsage:
    entry = AiUsage(
        user_id=user_id,
        provider=provider,
        model=model,
        kind=kind,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        created_at=datetime.now(timezone.utc),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def list_usage(
    session: Session,
    user_id: str,
    limit: int = 100,
    provider: str | None = None,
    days: int | None = None,
) -> list[AiUsage]:
    stmt = select(AiUsage).where(AiUsage.user_id == user_id).order_by(AiUsage.created_at.desc())
    if provider:
        stmt = stmt.where(AiUsage.provider == provider)
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = stmt.where(AiUsage.created_at >= cutoff)
    stmt = stmt.limit(limit)
    return list(session.scalars(stmt).all())


def get_summary(session: Session, user_id: str, days: int | None = None) -> dict[str, Any]:
    """Aggregate totals, by provider/model and daily buckets for last 7/30 days."""
    base_where = [AiUsage.user_id == user_id]
    cutoff = None
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        base_where.append(AiUsage.created_at >= cutoff)

    # totals
    stmt = select(
        func.coalesce(func.sum(AiUsage.prompt_tokens), 0),
        func.coalesce(func.sum(AiUsage.completion_tokens), 0),
        func.coalesce(func.sum(AiUsage.total_tokens), 0),
        func.count(AiUsage.id),
    ).where(and_(*base_where))
    prompt, completion, total, count = session.execute(stmt).one()

    # by provider
    stmt_p = select(
        AiUsage.provider,
        func.coalesce(func.sum(AiUsage.total_tokens), 0),
        func.count(AiUsage.id),
    ).where(and_(*base_where)).group_by(AiUsage.provider)
    by_provider = [{"provider": r[0], "tokens": r[1], "requests": r[2]} for r in session.execute(stmt_p).all()]

    # by model
    stmt_m = select(
        AiUsage.model,
        AiUsage.provider,
        func.coalesce(func.sum(AiUsage.total_tokens), 0),
        func.count(AiUsage.id),
    ).where(and_(*base_where)).group_by(AiUsage.model, AiUsage.provider)
    by_model = [{"model": r[0], "provider": r[1], "tokens": r[2], "requests": r[3]} for r in session.execute(stmt_m).all()]

    # daily buckets (group by date string) — SQLite vs PG compatible via func.date
    stmt_d = select(
        func.date(AiUsage.created_at),
        func.coalesce(func.sum(AiUsage.total_tokens), 0),
        func.count(AiUsage.id),
    ).where(and_(*base_where)).group_by(func.date(AiUsage.created_at)).order_by(func.date(AiUsage.created_at))
    rows = session.execute(stmt_d).all()
    daily = [{"date": str(r[0]), "tokens": r[1], "requests": r[2]} for r in rows]

    # daily by model for trend chart with providers
    stmt_dm = select(
        func.date(AiUsage.created_at),
        AiUsage.model,
        AiUsage.provider,
        func.coalesce(func.sum(AiUsage.total_tokens), 0),
    ).where(and_(*base_where)).group_by(func.date(AiUsage.created_at), AiUsage.model, AiUsage.provider).order_by(func.date(AiUsage.created_at))
    rows_dm = session.execute(stmt_dm).all()
    # build map date -> {model: tokens}
    daily_by_model_map: dict[str, dict[str, int]] = {}
    model_set: set[str] = set()
    for d, m, p, t in rows_dm:
        ds = str(d)
        model_set.add(m)
        daily_by_model_map.setdefault(ds, {})[m] = t
    # sorted dates
    all_dates = sorted(daily_by_model_map.keys()) if daily_by_model_map else [str(r[0]) for r in rows]
    # fallback if no per-model rows, use daily totals for single series
    daily_by_model = []
    for d in all_dates:
        by_model_dict = daily_by_model_map.get(d, {})
        daily_by_model.append({"date": d, "by_model": by_model_dict})

    # peak tokens (max daily)
    peak_tokens = max((r["tokens"] for r in daily), default=0)
    # longest session = max total_tokens per single log in period
    stmt_max = select(func.coalesce(func.max(AiUsage.total_tokens), 0)).where(and_(*base_where))
    longest_session = session.execute(stmt_max).scalar() or 0

    # streaks based on daily presence
    date_strs = [r["date"] for r in daily]
    # longest streak and current streak (consecutive days with tokens>0)
    # Build set of dates with usage
    from datetime import date as date_cls

    def parse_d(s: str):
        try:
            return date_cls.fromisoformat(s)
        except Exception:
            return None

    dates_with = {parse_d(s) for s in date_strs if parse_d(s)}
    # current streak: from today backwards
    today = datetime.now(timezone.utc).date()
    current_streak = 0
    cursor = today
    while cursor in dates_with:
        current_streak += 1
        cursor = cursor - timedelta(days=1)
    # longest streak: scan sorted dates
    sorted_dates = sorted(d for d in dates_with if d)
    longest_streak = 0
    run = 0
    prev = None
    for d in sorted_dates:
        if prev and (d - prev).days == 1:
            run += 1
        else:
            run = 1
        longest_streak = max(longest_streak, run)
        prev = d

    return {
        "total_prompt_tokens": prompt,
        "total_completion_tokens": completion,
        "total_tokens": total,
        "total_requests": count,
        "by_provider": by_provider,
        "by_model": sorted(by_model, key=lambda x: x["tokens"], reverse=True),
        "daily": daily,
        "daily_by_model": daily_by_model,
        "peak_tokens": peak_tokens,
        "longest_session_tokens": longest_session,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "model_list": sorted(list(model_set)),
    }
