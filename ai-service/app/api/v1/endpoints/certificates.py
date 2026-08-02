from fastapi import APIRouter
from app.models.certificates import CertificateRequest
from app.services.certificates import generate_certificate_design

router = APIRouter()


@router.post("/generate")
async def generate_certificate(request: CertificateRequest):
    result = await generate_certificate_design(request.task)
    return {
        "certificate_design": result
    }