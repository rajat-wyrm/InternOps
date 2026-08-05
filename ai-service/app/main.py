from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from app.core.config import settings
from app.core.database import get_pool, close_pool
from app.core.redis_client import connect_redis, disconnect_redis

from app.api.ai_routes import router as ai_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.certificates import router as certificates_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()

    try:
        await connect_redis()
    except Exception as exc:
        logger.warning(
            "Redis is unavailable. Continuing without cache: %s",
            exc,
        )

    try:
        yield
    finally:
        await disconnect_redis()
        await close_pool()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
)


app.include_router(certificates_router, prefix="/certificates", tags=["Certificates"])
app.include_router(ai_router)
app.include_router(health_router)

@app.get("/")
async def root():
    return {
        "message": "InternOps AI Service is running!"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "ok"
    }


