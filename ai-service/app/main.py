from fastapi import FastAPI
from app.core.config import settings
from app.core.database import close_pool

app = FastAPI(
    title=settings.PROJECT_NAME
)
@app.on_event("shutdown")
async def shutdown():
    await close_pool()

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