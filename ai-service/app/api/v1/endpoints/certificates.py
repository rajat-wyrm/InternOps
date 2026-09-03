from fastapi import APIRouter, Depends, HTTPException, status

from app.core.rbac import require_permission
from app.models.certificates import (
    CertificatePreviewRequest,
    CertificateRequest,
    DesignSuggestRequest,
    GenerateAchievementRequest,
    GenerateContentRequest,
    MatchTemplateRequest,
    MultiLanguageRequest,
    ToneCustomizeRequest,
    ValidateCertificateRequest,
)
from app.services.certificates import (
    generate_achievement_statement,
    generate_certificate_design,
    generate_content,
    generate_in_language,
    generate_with_tone,
    get_available_tones,
    get_design_templates,
    get_supported_languages,
    match_template,
    render_certificate_preview,
    suggest_design,
    validate_certificate,
)

router = APIRouter()

# All certificate-generation endpoints below mirror the ADMIN-only access
# the reference Node routes enforce (auth + rbac('ADMIN') on the whole module).
_ADMIN_ONLY = [Depends(require_permission("AI_CERTIFICATES"))]


@router.post("/generate")
async def generate_certificate(request: CertificateRequest):
    result = await generate_certificate_design(request.task)
    return {
        "certificate_design": result
    }


# ============================================================
# Validation (Group 3 functionality)
# ============================================================


@router.post("/validate", dependencies=_ADMIN_ONLY)
async def validate_certificate_endpoint(request: ValidateCertificateRequest):
    result = await validate_certificate(
        name=request.name,
        company=request.company,
        achievement=request.achievement,
        date=request.date,
        use_ai=request.use_ai,
    )
    return {"success": True, "data": result}


# ============================================================
# Text Generation (Group 1 functionality)
# ============================================================


@router.post("/generate-achievement", dependencies=_ADMIN_ONLY)
async def generate_achievement_endpoint(request: GenerateAchievementRequest):
    result = await generate_achievement_statement(
        recipient_name=request.recipient_name,
        recognition_type=request.recognition_type,
        core_achievement=request.core_achievement,
        desired_tone=request.desired_tone,
    )
    return {"success": True, "data": result}


@router.post("/generate-content", dependencies=_ADMIN_ONLY)
async def generate_content_endpoint(request: GenerateContentRequest):
    result = await generate_content(
        prompt=request.prompt,
        tone=request.tone,
        content_type=request.content_type,
    )
    return {"success": True, "data": result}


# ============================================================
# Template Matching (Group 2 functionality)
# ============================================================


@router.post("/match-template", dependencies=_ADMIN_ONLY)
async def match_template_endpoint(request: MatchTemplateRequest):
    result = await match_template(
        certificate_type=request.certificate_type,
        tone=request.tone,
        industry=request.industry,
        style=request.style,
        audience=request.audience,
        language=request.language,
        user_text=request.user_text,
    )
    return {"success": True, "data": result}


# ============================================================
# Tone Customizer
# ============================================================


@router.post("/tone-customize", dependencies=_ADMIN_ONLY)
async def tone_customize_endpoint(request: ToneCustomizeRequest):
    try:
        result = await generate_with_tone(
            recipient_name=request.recipient_name,
            company_name=request.company_name,
            tone=request.tone,
            certificate_type=request.certificate_type,
            achievement=request.achievement,
        )
    except ValueError as e:
        return {"success": False, "error": str(e)}
    return {"success": True, "data": result}


@router.get("/tones", dependencies=_ADMIN_ONLY)
async def list_tones_endpoint():
    return {"success": True, "data": get_available_tones()}


# ============================================================
# Multi-Language Support
# ============================================================


@router.post("/generate-multilanguage", dependencies=_ADMIN_ONLY)
async def generate_multilanguage_endpoint(request: MultiLanguageRequest):
    try:
        result = await generate_in_language(
            recipient_name=request.recipient_name,
            company_name=request.company_name,
            language=request.language,
            certificate_type=request.certificate_type,
            achievement=request.achievement,
        )
    except ValueError as e:
        return {"success": False, "error": str(e)}
    return {"success": True, "data": result}


@router.get("/languages", dependencies=_ADMIN_ONLY)
async def list_languages_endpoint():
    return {"success": True, "data": get_supported_languages()}


# ============================================================
# Design Suggestions
# ============================================================


@router.post("/design-suggest", dependencies=_ADMIN_ONLY)
async def design_suggest_endpoint(request: DesignSuggestRequest):
    result = await suggest_design(
        certificate_type=request.certificate_type,
        industry=request.industry,
        style=request.style,
        tone=request.tone,
        audience=request.audience,
    )
    return {"success": True, "data": result}


@router.get("/design-templates", dependencies=_ADMIN_ONLY)
async def design_templates_endpoint():
    return {"success": True, "data": get_design_templates()}


# ============================================================
# Certificate Preview (HTML rendering with design templates)
# ============================================================


@router.post("/preview", dependencies=_ADMIN_ONLY)
async def preview_endpoint(request: CertificatePreviewRequest):
    result = render_certificate_preview(
        recipient_name=request.recipient_name,
        title=request.title,
        body=request.body,
        closing=request.closing,
        template_name=request.template_name,
        logo_url=request.logo_url,
    )
    return {"success": True, "data": result}
