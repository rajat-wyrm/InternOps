from fastapi import APIRouter

from . import notice_assistant

api_router = APIRouter()
api_router.include_router(notice_assistant.router, prefix="/ai", tags=["AI"])
