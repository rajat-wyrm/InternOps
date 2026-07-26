from fastapi import FastAPI
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME
)

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