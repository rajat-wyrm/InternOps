from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME
)

app.include_router(api_router, prefix="/api/v1")


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
