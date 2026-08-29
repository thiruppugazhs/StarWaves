"""Studio API routes package — combines per-feature routers into one."""

from fastapi import APIRouter

from app.api.routes.studio import build, git, preview, projects, templates

router = APIRouter()
router.include_router(projects.router, tags=["Studio projects"])
router.include_router(build.router, tags=["Studio build"])
router.include_router(git.router, tags=["Studio git"])
router.include_router(preview.router, tags=["Studio preview"])
router.include_router(templates.router, tags=["Studio templates"])

__all__ = ["router"]
