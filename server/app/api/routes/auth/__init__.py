"""Authentication routes, grouped by feature.

Each feature group lives in its own module and defines a router under the
``/auth`` prefix. This package re-exports them through a single combined
``router`` so consumers keep using ``auth.router``.
"""

from fastapi import APIRouter

from app.api.routes.auth.account import router as account_router
from app.api.routes.auth.combine import router as combine_router
from app.api.routes.auth.credentials import router as credentials_router
from app.api.routes.auth.oauth import router as oauth_router
from app.api.routes.auth.password import router as password_router
from app.api.routes.auth.sessions import router as sessions_router

router = APIRouter()
router.include_router(oauth_router)
router.include_router(credentials_router)
router.include_router(password_router)
router.include_router(account_router)
router.include_router(combine_router)
router.include_router(sessions_router)
