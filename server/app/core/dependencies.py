"""Reusable FastAPI dependency aliases — single source for auth/DB DI.

Replaces 40+ repetitions of user: dict = Depends(get_current_user) with
typed Annotated aliases, and centralizes DB client injection.
"""

from typing import Annotated

from fastapi import Depends

from app.core.auth import get_current_user
from app.db import SqlClient, get_db_client

CurrentUser = Annotated[dict, Depends(get_current_user)]

# Helper to extract just the uid string — avoids repeated user["uid"] boilerplate
def _get_current_user_id(user: CurrentUser) -> str:
    return user["uid"]


CurrentUserId = Annotated[str, Depends(_get_current_user_id)]

# DB client alias — direct SQL database client
DbClient = Annotated[SqlClient, Depends(get_db_client)]
