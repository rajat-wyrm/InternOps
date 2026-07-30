from fastapi import FastAPI
from app.core.config import settings
from app.core.database import get_pool, close_pool
from app.api.ai_routes import router as ai_router
from app.api.v1.endpoints.health import router as health_router

app = FastAPI(
    title=settings.PROJECT_NAME
)
@app.on_event("startup")
async def startup():
    await get_pool()
@app.on_event("shutdown")
async def shutdown():
    await close_pool()

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

print("main.py loaded")    