from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai_routes import router as ai_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.certificates import router as certificates_router
from app.api.v1.endpoints.attendance import router as attendance_router
from app.api.v1.endpoints.generate import router as generate_router
from app.api.v1.endpoints.assignment_visuals import router as assignment_visuals_router
from app.core.config import settings
from app.core.database import get_pool, close_pool
from app.core.redis_client import connect_redis, disconnect_redis

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-User-ID"],
)


app.include_router(certificates_router, prefix="/certificates", tags=["Certificates"])
app.include_router(ai_router)
app.include_router(health_router)
app.include_router(attendance_router, prefix="/api/v1")
app.include_router(generate_router)
app.include_router(assignment_visuals_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "InternOps AI Service is running!"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}
