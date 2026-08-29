import asyncio
import logging
import os
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import HTTPException as FastAPIHTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.api.routes.calls_ws import router as calls_ws_router
from app.api.routes.twilio_relay import router as twilio_relay_router
from app.api.routes.whatsapp_ws import router as whatsapp_ws_router
from app.core.config import settings
from app.core.cors import ALLOWED_ORIGIN_REGEX, is_allowed_origin as _is_allowed_origin
from app.core.rate_limit import RateLimitMiddleware
from app.core.worker import server_worker

from app.db.session import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.app_env == "production":
        if not settings.auth_secret_key or settings.auth_secret_key.startswith("starwaves-super-secret"):
            raise RuntimeError("AUTH_SECRET_KEY must be set to a strong random value in production")
        if not settings.cron_secret:
            raise RuntimeError("CRON_SECRET must be set in production")
    logger.info("Initializing %s (env=%s)...", settings.app_name, settings.app_env)
    logger.info(
        "AI runtime config: provider=openai model=%s base_url=%s",
        settings.openai_model,
        settings.openai_url or "https://api.openai.com/v1 (default)",
    )
    try:
        await init_db()
    except Exception as err:
        logger.warning("Could not auto-init database tables: %s", err)
    # Unified serverless detection: VERCEL (Vercel), AWS_LAMBDA_FUNCTION_NAME (Lambda), or explicit IS_SERVERLESS
    is_serverless = bool(
        os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("IS_SERVERLESS") == "true"
    )
    if not is_serverless:
        try:
            server_worker.start()
        except Exception as err:
            logger.warning("Could not start background worker daemon: %s", err)
    yield
    logger.info("Shutting down %s...", settings.app_name)
    if not is_serverless:
        try:
            server_worker.stop()
        except Exception as err:
            logger.warning("Error stopping background worker daemon: %s", err)


def create_app() -> FastAPI:
    is_prod = settings.app_env == "production"
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs" if not is_prod else None,
        redoc_url="/redoc" if not is_prod else None,
        openapi_url="/openapi.json" if not is_prod else None,
        lifespan=lifespan,
    )

    # Standard ASGI CORS Middleware (pure ASGI handler for preflight and standard requests)
    application.add_middleware(RateLimitMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=ALLOWED_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
        expose_headers=["Content-Length"],
        max_age=86400,
    )

    @application.middleware("http")
    async def security_headers_middleware(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(self), camera=(self)"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; "
            "style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
        )
        return response

    @application.exception_handler(FastAPIHTTPException)
    @application.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        origin = request.headers.get("origin")
        response = JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None) or {},
        )
        if _is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        origin = request.headers.get("origin")
        # exc.errors() may embed raw exception instances in ctx; make them JSON-safe.
        response = JSONResponse(
            status_code=422,
            content={"detail": jsonable_encoder(exc.errors())},
        )
        if _is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
        origin = request.headers.get("origin")
        response = JSONResponse(
            status_code=500,
            content={
                "detail": str(exc)
                if settings.app_env == "development"
                else "An internal server error occurred."
            },
        )
        if _is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    application.include_router(api_router, prefix=settings.api_v1_prefix)
    # WebSocket endpoints mount at root path (/ws/calls, /ws/whatsapp, /ws/twilio-relay)
    application.include_router(calls_ws_router)
    application.include_router(whatsapp_ws_router)
    application.include_router(twilio_relay_router)

    return application


app = create_app()
