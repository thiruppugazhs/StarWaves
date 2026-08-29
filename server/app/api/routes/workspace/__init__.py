"""Workspace data routes, grouped by feature.

Each feature group lives in its own module and defines a router. This package
re-exports them through a single combined ``router`` so consumers keep using
``workspace.router``.
"""

from fastapi import APIRouter

from app.api.routes.workspace.calendar import router as calendar_router
from app.api.routes.workspace.contests import router as contests_router
from app.api.routes.workspace.hackathons import router as hackathons_router
from app.api.routes.workspace.jobs import router as jobs_router
from app.api.routes.workspace.notifications import router as notifications_router
from app.api.routes.workspace.projects import router as projects_router

router = APIRouter()
router.include_router(jobs_router)
router.include_router(hackathons_router)
router.include_router(projects_router)
router.include_router(notifications_router)
router.include_router(contests_router)
router.include_router(calendar_router)
