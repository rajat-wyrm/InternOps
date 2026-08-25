from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/api/providers", tags=["Health"])

@router.get("/health")
async def providers_health():
    providers = []

    providers.append({
        "name": settings.PRIMARY_AI_PROVIDER,
        "status": "configured"
    })

    for provider in settings.ACTIVE_FALLBACK_PROVIDERS:
        providers.append({
            "name": provider,
            "status": "configured"
        })

    return {"providers": providers}
