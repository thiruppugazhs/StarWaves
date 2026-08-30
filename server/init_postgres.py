import logging
from sqlalchemy import text
from app.db.session import sync_engine, is_sqlite
from app.db.base import Base
import app.models  # noqa: F401

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    logger.info("Initializing database schema...")
    with sync_engine.connect() as conn:
        if not is_sqlite:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
                logger.info("Vector extension ensured.")
            except Exception as e:
                logger.warning("Vector extension warning: %s", e)

    Base.metadata.create_all(bind=sync_engine)
    logger.info("Successfully verified/created %d tables: %s", len(Base.metadata.tables), list(Base.metadata.tables.keys()))

if __name__ == "__main__":
    main()
