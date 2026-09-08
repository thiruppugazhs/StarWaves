"""Database probe — isolated in its own service so health aggregator stays lean."""

import time

from sqlalchemy import text

from app.services.health.constants import EXPECTED_TABLES, elapsed_ms


async def check_database() -> dict:
    t0 = time.monotonic()
    try:
        from app.db.session import engine, is_sqlite, sync_engine

        if is_sqlite:
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            return {"status": "ok", "latency_ms": elapsed_ms(t0), "detail": "sqlite SELECT 1 ok"}

        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))

        tables_detail = "ok"
        try:
            with sync_engine.connect() as conn:
                rows = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'")).fetchall()
                present = {r[0] for r in rows}
                missing = [t for t in EXPECTED_TABLES if t not in present]
                if missing:
                    tables_detail = f"missing tables: {', '.join(missing)}"
                else:
                    tables_detail = f"{len(EXPECTED_TABLES)} tables present"
        except Exception as exc:  # pragma: no cover
            tables_detail = f"table inventory failed: {exc}"

        vector_detail = ""
        try:
            with sync_engine.connect() as conn:
                row = conn.execute(text("SELECT extname FROM pg_extension WHERE extname='vector'")).fetchone()
                vector_detail = "vector extension present" if row else "vector extension missing (eve_memories will fail on fresh DB)"
        except Exception:
            pass
        detail = f"postgres SELECT 1 ok; {tables_detail}"
        if vector_detail:
            detail += f"; {vector_detail}"
        return {"status": "ok" if "missing" not in tables_detail else "degraded", "latency_ms": elapsed_ms(t0), "detail": detail}
    except Exception as exc:
        return {"status": "error", "latency_ms": elapsed_ms(t0), "detail": f"database unreachable: {exc}"}
