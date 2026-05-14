"""
main.py — FastAPI application entry point.

- Lifespan: initialises the database on startup.
- Middleware: CORS (configured for development; restrict in production).
- Routers: sensor ingestion, worker queries, WebSocket, auth, admin.
- Health check at GET /.
"""

import asyncio
import logging
import logging.config
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import sensor, websocket, workers
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router
from app.routes.geofence import router as geofence_router
from app.services.mqtt_subscriber import run_mqtt_subscriber

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

LOGGING_CONFIG: dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"],
    },
    "loggers": {
        "app": {"level": "DEBUG", "propagate": True},
        "sqlalchemy.engine": {"level": "WARNING", "propagate": True},
        "uvicorn": {"level": "INFO", "propagate": True},
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Run startup and shutdown tasks."""
    logger.info("Starting Industrial Safety Monitoring System …")
    await init_db()

    # Start MQTT subscriber as a background task
    mqtt_task = asyncio.create_task(run_mqtt_subscriber())
    logger.info("Application ready.")
    yield

    # Graceful shutdown: cancel MQTT task
    mqtt_task.cancel()
    try:
        await mqtt_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutting down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="Industrial Safety Monitoring System",
        description=(
            "Real-time IoT safety monitoring for industrial workers. "
            "Ingests ESP32 sensor data (including GPS), detects falls and gas hazards, "
            "streams live alerts over WebSocket, and supports multi-admin worker management."
        ),
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # -----------------------------------------------------------------------
    # CORS middleware
    # -----------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -----------------------------------------------------------------------
    # Routers
    # -----------------------------------------------------------------------
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(sensor.router)
    app.include_router(workers.router)
    app.include_router(websocket.router)
    app.include_router(geofence_router)

    # -----------------------------------------------------------------------
    # Health check
    # -----------------------------------------------------------------------
    @app.get("/", tags=["Health"], summary="Health check")
    async def health() -> dict:
        return {"status": "ok", "service": "Industrial Safety Monitoring System v2"}

    return app


app = create_app()
