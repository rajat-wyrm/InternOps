from fastapi import APIRouter
from app.api.v1.endpoints.generate import router as generate_router

api_router = APIRouter()
api_router.include_router(generate_router, tags=["generate"])
