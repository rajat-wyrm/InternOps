import pytest

from fastapi import HTTPException

from app.services.certificates import generate_certificate_design
from app.providers.orchestrator import ai_orchestrator


@pytest.mark.asyncio
async def test_certificate_generation_uses_orchestrator(monkeypatch):
    async def mock_generate(messages):
        prompt = messages[0]["content"]

        assert "test task" in prompt.lower()

        return "Generated certificate design", "mock-provider"

    monkeypatch.setattr(
        ai_orchestrator,
        "generate_chat_with_fallback",
        mock_generate,
    )

    result = await generate_certificate_design("Test task")

    assert result == "Generated certificate design"


@pytest.mark.asyncio
async def test_certificate_generation_returns_502_on_provider_failure(monkeypatch):
    async def mock_generate(messages):
        raise Exception("Provider failed")

    monkeypatch.setattr(
        ai_orchestrator,
        "generate_chat_with_fallback",
        mock_generate,
    )

    with pytest.raises(HTTPException) as exc_info:
        await generate_certificate_design("Test task")

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Failed to generate certificate design."


# ---------------------------------------------------------------------------
# Validation (Group 3 functionality)
# ---------------------------------------------------------------------------

from app.services.certificates import (  # noqa: E402
    AVAILABLE_TONES,
    DESIGN_TEMPLATES,
    SUPPORTED_LANGUAGES,
    generate_achievement_statement,
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


@pytest.mark.asyncio
async def test_validate_certificate_uses_ai_beautification(monkeypatch):
    async def mock_generate(messages):
        return "A beautifully polished sentence.", "mock-provider"

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await validate_certificate(
        name="  Asha  ", company=" Acme ", achievement=" built cool stuff ",
    )

    assert result["status"] == "success"
    assert result["text"] == "A beautifully polished sentence."
    assert result["font_size"] == 40
    assert result["cleaned"] == {
        "name": "Asha",
        "company": "Acme",
        "achievement": "built cool stuff",
        "date": None,
    }


@pytest.mark.asyncio
async def test_validate_certificate_falls_back_when_ai_unavailable(monkeypatch):
    async def mock_generate(messages):
        raise Exception("Provider failed")

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await validate_certificate(
        name="Asha", company="Acme", achievement="built cool stuff",
    )

    assert result["text"] == "Asha from Acme - built cool stuff"


@pytest.mark.asyncio
async def test_validate_certificate_skips_ai_when_disabled(monkeypatch):
    called = False

    async def mock_generate(messages):
        nonlocal called
        called = True
        return "should not be used", "mock-provider"

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await validate_certificate(
        name="Asha", company="Acme", achievement="built cool stuff", use_ai=False,
    )

    assert called is False
    assert result["text"] == "Asha from Acme - built cool stuff"


# ---------------------------------------------------------------------------
# Text generation (Group 1 functionality)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_achievement_statement_uses_orchestrator(monkeypatch):
    async def mock_generate(messages):
        return "Congrats on a great achievement.", "mock-provider"

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await generate_achievement_statement(
        recipient_name="Asha",
        recognition_type="Internship",
        core_achievement="shipping a feature",
    )

    assert result == {"status": "success", "statement": "Congrats on a great achievement."}


@pytest.mark.asyncio
async def test_generate_achievement_statement_falls_back(monkeypatch):
    async def mock_generate(messages):
        raise Exception("down")

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await generate_achievement_statement(
        recipient_name="Asha",
        recognition_type="Internship",
        core_achievement="shipping a feature",
    )

    assert "Asha" in result["statement"]
    assert "shipping a feature" in result["statement"]


@pytest.mark.asyncio
async def test_generate_content_falls_back(monkeypatch):
    async def mock_generate(messages):
        raise Exception("down")

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await generate_content(prompt="a blog post", tone="casual", content_type="blog post")

    assert result["generated_text"] == "This is a professional blog post with a casual tone."


# ---------------------------------------------------------------------------
# Tone customizer
# ---------------------------------------------------------------------------


def test_available_tones_list():
    assert get_available_tones() == AVAILABLE_TONES
    # returned list must be a copy, not the module-level list itself
    assert get_available_tones() is not AVAILABLE_TONES


@pytest.mark.asyncio
async def test_generate_with_tone_rejects_invalid_tone():
    with pytest.raises(ValueError):
        await generate_with_tone(
            recipient_name="Asha", company_name="Acme", tone="Sarcastic",
        )


@pytest.mark.asyncio
async def test_generate_with_tone_uses_ai_json(monkeypatch):
    async def mock_generate(messages):
        return (
            '{"title": "Certificate", "body": "Well done", "closing": "Bye"}',
            "mock-provider",
        )

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await generate_with_tone(
        recipient_name="Asha", company_name="Acme", tone="Formal",
    )

    assert result == {
        "tone": "Formal",
        "title": "Certificate",
        "body": "Well done",
        "closing": "Bye",
    }


@pytest.mark.asyncio
async def test_generate_with_tone_falls_back_on_bad_json(monkeypatch):
    async def mock_generate(messages):
        return "not json at all", "mock-provider"

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await generate_with_tone(
        recipient_name="Asha", company_name="Acme", tone="Casual",
    )

    assert result["tone"] == "Casual"
    assert "Asha" in result["body"]
    assert result["closing"] == "Nice work!"


# ---------------------------------------------------------------------------
# Multi-language support
# ---------------------------------------------------------------------------


def test_supported_languages_list():
    assert get_supported_languages() == SUPPORTED_LANGUAGES
    assert get_supported_languages() is not SUPPORTED_LANGUAGES


@pytest.mark.asyncio
async def test_generate_in_language_rejects_unsupported_language():
    with pytest.raises(ValueError):
        await generate_in_language(
            recipient_name="Asha", company_name="Acme", language="Klingon",
        )


@pytest.mark.asyncio
async def test_generate_in_language_falls_back(monkeypatch):
    async def mock_generate(messages):
        raise Exception("down")

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await generate_in_language(
        recipient_name="Asha", company_name="Acme", language="French",
        achievement="graduating",
    )

    assert result["language"] == "French"
    assert "Asha" in result["body"]
    assert "graduating" in result["body"]


# ---------------------------------------------------------------------------
# Design templates and suggestions
# ---------------------------------------------------------------------------


def test_get_design_templates_returns_full_list():
    templates = get_design_templates()
    assert templates == DESIGN_TEMPLATES
    assert templates is not DESIGN_TEMPLATES
    assert len(templates) > 0
    for template in templates:
        assert {"name", "emoji", "style", "colors", "font", "best_for"} <= template.keys()


@pytest.mark.asyncio
async def test_suggest_design_uses_ai_recommendations(monkeypatch):
    async def mock_generate(messages):
        return (
            '{"recommendations": [{"name": "AI Blue", "reason": "fits", "confidence": "high"}]}',
            "mock-provider",
        )

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await suggest_design(
        certificate_type="Internship", industry="AI", style="Modern", tone="Formal",
        audience="Professional",
    )

    assert result["recommendations"][0]["name"] == "AI Blue"


@pytest.mark.asyncio
async def test_suggest_design_falls_back_to_rule_based_scoring(monkeypatch):
    async def mock_generate(messages):
        raise Exception("down")

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await suggest_design(
        certificate_type="Coding", industry="AI", style="Futuristic",
        tone="Formal", audience="Professional",
    )

    names = [r["name"] for r in result["recommendations"]]
    assert "AI Blue" in names
    assert len(result["recommendations"]) == 3


@pytest.mark.asyncio
async def test_match_template_uses_ai_pick(monkeypatch):
    async def mock_generate(messages):
        return "I'd go with Carbon Pro for this.", "mock-provider"

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await match_template(certificate_type="Internship", style="Industrial")

    assert result["best_match"]["name"] == "Carbon Pro"
    assert len(result["top_3"]) == 3


@pytest.mark.asyncio
async def test_match_template_falls_back_to_first_template(monkeypatch):
    async def mock_generate(messages):
        raise Exception("down")

    monkeypatch.setattr(
        ai_orchestrator, "generate_chat_with_fallback", mock_generate
    )

    result = await match_template(certificate_type="Internship")

    assert result["best_match"] == DESIGN_TEMPLATES[0]


# ---------------------------------------------------------------------------
# Certificate preview
# ---------------------------------------------------------------------------


def test_render_certificate_preview_escapes_html_and_uses_template():
    result = render_certificate_preview(
        recipient_name="<script>alert(1)</script>",
        title="Certificate & Honor",
        template_name="Tech Dark",
    )

    assert "<script>" not in result["html"]
    assert "&lt;script&gt;" in result["html"]
    assert "Certificate &amp; Honor" in result["html"]
    assert result["style"] == {
        "bg": "#0a0e1a", "fg": "#00e5ff", "border": "2px solid #00e5ff",
        "font": "Courier New, monospace",
    }


def test_render_certificate_preview_defaults_to_modern_minimal():
    result = render_certificate_preview(recipient_name="Asha", template_name="Unknown Template")

    assert result["style"]["bg"] == "#ffffff"
    assert "Congratulations" in result["html"]