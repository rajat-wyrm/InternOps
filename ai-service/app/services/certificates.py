"""
Certificate generation service.

Ports the certificate-generation functionality described in `ai-service/tasks.md`
and `ai-service/reference/ai_certificates_service.js` to Python, using the
existing AI orchestrator (multi-provider failover) instead of the Node
`aiProviderService`.

Scope covered here (see GitHub issue #1895):
  - Input validation, with optional AI text beautification (Group 3)
  - Achievement statement / general content generation (Group 1)
  - Template matching and design suggestions (Group 2)
  - Tone customization
  - Multi-language generation
  - Certificate design generation (existing `/generate` endpoint, unchanged)
  - HTML certificate preview

Out of scope for this port (tracked separately, see tasks.md): bulk AI
generation and PNG/PDF certificate rendering. Both depend on persistence
(a certificates repository/job table) and a PDF-rendering pipeline that does
not yet exist in `ai-service` — porting them here would mean building new
infrastructure rather than the certificate-generation logic this issue is
about.
"""

import json
import logging
import re
from html import escape as _escape_html
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from app.prompts.certificates import (
    build_achievement_prompt,
    build_beautify_prompt,
    build_certificate_prompt,
    build_content_prompt,
    build_design_suggestion_prompt,
    build_language_prompt,
    build_template_match_prompt,
    build_tone_prompt,
)
from app.providers.orchestrator import ai_orchestrator

logger = logging.getLogger(__name__)


async def generate_certificate_design(task: str):
    try:
        prompt = build_certificate_prompt(task)

        response, _ = await ai_orchestrator.generate_chat_with_fallback(
            [{"role": "user", "content": prompt}]
        )

        return response

    except Exception:
        logger.exception("Failed to generate certificate design")
        raise HTTPException(
            status_code=502,
            detail="Failed to generate certificate design.",
        )


# ---------------------------------------------------------------------------
# Shared AI helpers
#
# Every certificate-generation capability below is expected to keep working
# even when every AI provider is unavailable, so these helpers swallow
# provider errors and let callers fall back to deterministic templates -
# mirroring the try/catch-to-fallback structure of the reference JS.
# ---------------------------------------------------------------------------


def _strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


async def _ai_text(prompt: str) -> Optional[str]:
    try:
        raw, _ = await ai_orchestrator.generate_chat_with_fallback(
            [{"role": "user", "content": prompt}]
        )
        text = raw.strip()
        return text or None
    except Exception:
        logger.warning("AI text generation failed; using fallback", exc_info=True)
        return None


async def _ai_json(prompt: str) -> Optional[Dict[str, Any]]:
    raw = await _ai_text(prompt)
    if raw is None:
        return None
    try:
        parsed = json.loads(_strip_json_fences(raw))
        return parsed if isinstance(parsed, dict) else None
    except (json.JSONDecodeError, ValueError):
        logger.warning("AI JSON response could not be parsed; using fallback")
        return None


# ---------------------------------------------------------------------------
# Validation (Group 3 functionality)
# ---------------------------------------------------------------------------


async def validate_certificate(
    name: str,
    company: str,
    achievement: str,
    date: Optional[str] = None,
    use_ai: bool = True,
) -> Dict[str, Any]:
    """Clean/validate certificate fields, optionally polishing the summary text with AI."""
    cleaned = {
        "name": name.strip(),
        "company": company.strip(),
        "achievement": achievement.strip(),
        "date": date.strip() if date else None,
    }

    text = f"{cleaned['name']} from {cleaned['company']} - {cleaned['achievement']}"

    if use_ai:
        polished = await _ai_text(
            build_beautify_prompt(
                cleaned["name"], cleaned["company"], cleaned["achievement"]
            )
        )
        if polished:
            text = polished

    return {
        "status": "success",
        "text": text,
        "font_size": 40,
        "cleaned": cleaned,
    }


# ---------------------------------------------------------------------------
# Text generation (Group 1 functionality)
# ---------------------------------------------------------------------------


async def generate_achievement_statement(
    recipient_name: str,
    recognition_type: str,
    core_achievement: str,
    desired_tone: str = "Professional",
) -> Dict[str, Any]:
    statement = await _ai_text(
        build_achievement_prompt(
            recipient_name, recognition_type, core_achievement, desired_tone
        )
    )
    if not statement:
        statement = (
            f"This certificate is awarded to {recipient_name} in recognition of "
            f"their outstanding {core_achievement}."
        )
    return {"status": "success", "statement": statement}


async def generate_content(
    prompt: str,
    tone: str = "formal",
    content_type: str = "blog post",
) -> Dict[str, Any]:
    generated_text = await _ai_text(build_content_prompt(prompt, tone, content_type))
    if not generated_text:
        generated_text = f"This is a professional {content_type} with a {tone} tone."
    return {"status": "success", "generated_text": generated_text}


# ---------------------------------------------------------------------------
# Tone Customizer
# ---------------------------------------------------------------------------

AVAILABLE_TONES: List[str] = [
    "Professional",
    "Formal",
    "Friendly",
    "Motivational",
    "Casual",
]


def get_available_tones() -> List[str]:
    return list(AVAILABLE_TONES)


def _tone_fallback(
    recipient_name: str,
    company_name: str,
    certificate_type: str,
    achievement: str,
    tone: str,
) -> Dict[str, str]:
    fallbacks = {
        "Professional": {
            "title": f"Certificate of {certificate_type or 'Achievement'}",
            "body": (
                f"This certificate is proudly presented to {recipient_name} from "
                f"{company_name} in recognition of {achievement}."
            ),
            "closing": "With professional regards",
        },
        "Formal": {
            "title": f"Official Certificate of {certificate_type or 'Completion'}",
            "body": (
                f"We hereby certify that {recipient_name} of {company_name} has "
                f"demonstrated exceptional performance in {achievement}."
            ),
            "closing": "By official authority",
        },
        "Friendly": {
            "title": f"Way to Go, {recipient_name}!",
            "body": (
                f"Huge congrats to {recipient_name} from {company_name} for "
                f"crushing {achievement}! Your hard work really paid off."
            ),
            "closing": "Cheers to your success!",
        },
        "Motivational": {
            "title": "Certificate of Excellence",
            "body": (
                f"{recipient_name} of {company_name} has proven that dedication "
                f"and perseverance lead to extraordinary results in {achievement}."
            ),
            "closing": "Keep reaching for the stars",
        },
        "Casual": {
            "title": "You Did It!",
            "body": (
                f"{recipient_name} from {company_name} just wrapped up "
                f"{achievement} and nailed it. Well done!"
            ),
            "closing": "Nice work!",
        },
    }
    return fallbacks.get(tone, fallbacks["Professional"])


async def generate_with_tone(
    recipient_name: str,
    company_name: str,
    tone: str,
    certificate_type: str = "Internship",
    achievement: Optional[str] = None,
) -> Dict[str, Any]:
    if tone not in AVAILABLE_TONES:
        raise ValueError(f"Invalid tone. Choose from: {', '.join(AVAILABLE_TONES)}")

    achievement = achievement or "successfully completed the program"

    ai_result = await _ai_json(
        build_tone_prompt(certificate_type, recipient_name, company_name, achievement, tone)
    )
    if ai_result and {"title", "body", "closing"} <= ai_result.keys():
        return {"tone": tone, **ai_result}

    fallback = _tone_fallback(
        recipient_name, company_name, certificate_type, achievement, tone
    )
    return {"tone": tone, **fallback}


# ---------------------------------------------------------------------------
# Multi-Language Support
# ---------------------------------------------------------------------------

SUPPORTED_LANGUAGES: List[str] = [
    "English",
    "Hindi",
    "Tamil",
    "Telugu",
    "Malayalam",
    "Kannada",
    "Bengali",
    "Marathi",
    "Gujarati",
    "French",
    "Spanish",
    "Arabic",
    "German",
    "Japanese",
    "Chinese (Simplified)",
]


def get_supported_languages() -> List[str]:
    return list(SUPPORTED_LANGUAGES)


async def generate_in_language(
    recipient_name: str,
    company_name: str,
    language: str,
    certificate_type: str = "Internship",
    achievement: Optional[str] = None,
) -> Dict[str, Any]:
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError(
            f"Unsupported language. Choose from: {', '.join(SUPPORTED_LANGUAGES)}"
        )

    achievement = achievement or "successfully completed the program"

    ai_result = await _ai_json(
        build_language_prompt(
            certificate_type, recipient_name, company_name, achievement, language
        )
    )
    if ai_result and {"title", "body", "closing"} <= ai_result.keys():
        return {"language": language, **ai_result}

    return {
        "language": language,
        "title": f"Certificate of {certificate_type or 'Achievement'}",
        "body": (
            f"This certificate is presented to {recipient_name} from "
            f"{company_name} for {achievement}."
        ),
        "closing": "Congratulations",
    }


# ---------------------------------------------------------------------------
# Design templates / suggestions (Group 2 functionality)
# ---------------------------------------------------------------------------

DESIGN_TEMPLATES: List[Dict[str, Any]] = [
    {"name": "Royal Gold", "emoji": "👑", "style": "Formal & Prestigious", "colors": "Navy + Gold", "font": "Georgia, serif", "best_for": ["Academic", "Award", "Graduation"]},
    {"name": "Ivory Scroll", "emoji": "📜", "style": "Classic & Timeless", "colors": "Ivory + Sepia + Brown", "font": "Palatino Linotype, serif", "best_for": ["Academic", "Historical", "Literature"]},
    {"name": "Oxford Blue", "emoji": "🎓", "style": "University & Academic", "colors": "Oxford Blue + Cream + Silver", "font": "Book Antiqua, serif", "best_for": ["Graduation", "Degree", "University"]},
    {"name": "Emerald Honor", "emoji": "🏅", "style": "Honor & Excellence", "colors": "Emerald Green + Gold + White", "font": "Garamond, serif", "best_for": ["Honor Roll", "Excellence", "Award"]},
    {"name": "Crimson Prestige", "emoji": "🎖️", "style": "Prestige & Authority", "colors": "Crimson + Black + Gold", "font": "Times New Roman, serif", "best_for": ["Award", "Leadership", "Excellence"]},
    {"name": "Modern Minimal", "emoji": "🏢", "style": "Clean & Professional", "colors": "White + Charcoal + Blue", "font": "Trebuchet MS, sans-serif", "best_for": ["Corporate", "Training", "Internship"]},
    {"name": "Slate Executive", "emoji": "💼", "style": "Executive & Corporate", "colors": "Slate Grey + White + Teal", "font": "Verdana, sans-serif", "best_for": ["Corporate", "Executive", "Management"]},
    {"name": "Carbon Pro", "emoji": "⚙️", "style": "Industrial & Bold", "colors": "Carbon Black + Orange + White", "font": "Impact, sans-serif", "best_for": ["Engineering", "Manufacturing", "Technical"]},
    {"name": "Navy Corporate", "emoji": "🔷", "style": "Trustworthy & Professional", "colors": "Navy + White + Gold Accent", "font": "Calibri, sans-serif", "best_for": ["Finance", "Banking", "Corporate"]},
    {"name": "Pearl White", "emoji": "🤍", "style": "Ultra-Clean Minimalist", "colors": "Pure White + Black + Thin Gray", "font": "Century Gothic, sans-serif", "best_for": ["Professional", "Corporate", "Consulting"]},
    {"name": "Tech Dark", "emoji": "💻", "style": "Futuristic & Bold", "colors": "Dark + Cyan + Blue", "font": "Courier New, monospace", "best_for": ["Coding", "Data Science", "IT"]},
    {"name": "Matrix Green", "emoji": "🟢", "style": "Hacker & Tech", "colors": "Black + Matrix Green", "font": "Lucida Console, monospace", "best_for": ["Cybersecurity", "Hacking", "Programming"]},
    {"name": "Neon Purple", "emoji": "🔮", "style": "Cyberpunk & Vivid", "colors": "Dark Purple + Neon + Pink", "font": "Trebuchet MS, sans-serif", "best_for": ["Gaming", "Technology", "Esports"]},
    {"name": "Circuit Board", "emoji": "🔌", "style": "Engineering & PCB", "colors": "PCB Green + Gold Traces", "font": "Courier New, monospace", "best_for": ["Electronics", "Engineering", "Hardware"]},
    {"name": "AI Blue", "emoji": "🤖", "style": "Artificial Intelligence", "colors": "Electric Blue + White + Dark", "font": "Verdana, sans-serif", "best_for": ["AI", "Machine Learning", "Data Science"]},
    {"name": "Floral Pastel", "emoji": "🌸", "style": "Elegant & Artistic", "colors": "Blush Pink + Lavender + Gold", "font": "Palatino Linotype, serif", "best_for": ["Art", "Design", "Music", "Creative"]},
    {"name": "Watercolor Blue", "emoji": "🎨", "style": "Artistic & Painterly", "colors": "Sky Blue + Soft Teal + White", "font": "Garamond, serif", "best_for": ["Art", "Design", "Painting"]},
    {"name": "Sunset Orange", "emoji": "🌅", "style": "Warm & Vibrant", "colors": "Sunset Orange + Deep Red + Cream", "font": "Georgia, serif", "best_for": ["Photography", "Art", "Film"]},
    {"name": "Vintage Sepia", "emoji": "📷", "style": "Retro & Nostalgic", "colors": "Sepia + Warm Brown + Cream", "font": "Palatino Linotype, serif", "best_for": ["Photography", "History", "Literature"]},
    {"name": "Art Deco Gold", "emoji": "✨", "style": "Art Deco & Glamour", "colors": "Black + Gold + Geometric", "font": "Georgia, serif", "best_for": ["Fashion", "Design", "Film", "Architecture"]},
    {"name": "Nature Green", "emoji": "🌿", "style": "Warm & Organic", "colors": "Forest Green + Cream", "font": "Georgia, serif", "best_for": ["Environment", "Community", "Wellness"]},
    {"name": "Ocean Breeze", "emoji": "🌊", "style": "Coastal & Fresh", "colors": "Ocean Blue + Sandy Beige", "font": "Trebuchet MS, sans-serif", "best_for": ["Marine", "Environment", "Geography"]},
    {"name": "Classic Red", "emoji": "🏆", "style": "Bold & Authoritative", "colors": "Crimson + White + Gold", "font": "Times New Roman, serif", "best_for": ["Sports", "Competition", "Award"]},
    {"name": "Champion Black", "emoji": "🥇", "style": "Champion & Elite", "colors": "Black + Gold + Silver", "font": "Impact, sans-serif", "best_for": ["Sports", "Champion", "Competition"]},
    {"name": "Sports Green", "emoji": "⚽", "style": "Field & Athletic", "colors": "Grass Green + White + Black", "font": "Trebuchet MS, sans-serif", "best_for": ["Football", "Cricket", "Sports"]},
    {"name": "Finance Gold", "emoji": "💰", "style": "Wealth & Finance", "colors": "Dark + Gold + Forest Green", "font": "Garamond, serif", "best_for": ["Finance", "Banking", "Accounting"]},
    {"name": "MBA Maroon", "emoji": "📊", "style": "Business School", "colors": "Maroon + Cream + Gold", "font": "Book Antiqua, serif", "best_for": ["MBA", "Business", "Management"]},
    {"name": "Startup Orange", "emoji": "🚀", "style": "Bold & Disruptive", "colors": "Vibrant Orange + Dark + White", "font": "Trebuchet MS, sans-serif", "best_for": ["Startup", "Entrepreneurship", "Innovation"]},
    {"name": "School Spirit", "emoji": "🏫", "style": "School Pride", "colors": "Blue + White + Yellow", "font": "Georgia, serif", "best_for": ["School", "Training", "Workshop"]},
    {"name": "Chalkboard", "emoji": "✏️", "style": "Educational & Playful", "colors": "Chalkboard Green + White Chalk", "font": "Courier New, monospace", "best_for": ["Education", "Teaching", "Workshop"]},
    {"name": "Medical Blue", "emoji": "🏥", "style": "Clinical & Trusted", "colors": "Medical Blue + White + Clean Grey", "font": "Verdana, sans-serif", "best_for": ["Medicine", "Healthcare", "Nursing"]},
    {"name": "Science Lab", "emoji": "🔬", "style": "Scientific & Precise", "colors": "Lab White + Deep Blue + Green Signal", "font": "Courier New, monospace", "best_for": ["Chemistry", "Biology", "Physics"]},
    {"name": "Astronomy Dark", "emoji": "🌌", "style": "Cosmic & Deep", "colors": "Space Black + Starlight + Deep Purple", "font": "Georgia, serif", "best_for": ["Astronomy", "Physics", "Space"]},
    {"name": "Harvard Crimson", "emoji": "📖", "style": "Ivy League Prestige", "colors": "Harvard Crimson + Black + Gold", "font": "Garamond, serif", "best_for": ["Academic", "Research", "Degree"]},
    {"name": "Rose Gold", "emoji": "💎", "style": "Premium & Feminine", "colors": "Rose Gold + Blush + Champagne", "font": "Georgia, serif", "best_for": ["Award", "Excellence", "Fashion"]},
    {"name": "Holographic", "emoji": "🌈", "style": "Futuristic & Iridescent", "colors": "Holographic Gradient + White", "font": "Century Gothic, sans-serif", "best_for": ["Innovation", "Technology", "Design"]},
    {"name": "Blueprint", "emoji": "📐", "style": "Architectural & Technical", "colors": "Blueprint Blue + White Lines", "font": "Courier New, monospace", "best_for": ["Architecture", "Engineering", "Design"]},
    {"name": "Saffron India", "emoji": "🇮🇳", "style": "Vibrant & Cultural", "colors": "Saffron + White + India Green", "font": "Georgia, serif", "best_for": ["India", "Culture", "Government"]},
    {"name": "Zen Lotus", "emoji": "🧘", "style": "Calm & Mindful", "colors": "Soft Lavender + White + Sage", "font": "Garamond, serif", "best_for": ["Yoga", "Meditation", "Wellness"]},
    {"name": "Jazz Noir", "emoji": "🎷", "style": "Jazz & Cool", "colors": "Noir Black + Warm Amber + Cream", "font": "Georgia, serif", "best_for": ["Music", "Jazz", "Arts"]},
]


def get_design_templates() -> List[Dict[str, Any]]:
    return list(DESIGN_TEMPLATES)


async def suggest_design(
    certificate_type: str,
    industry: Optional[str] = None,
    style: Optional[str] = None,
    tone: Optional[str] = None,
    audience: Optional[str] = None,
) -> Dict[str, Any]:
    industry = industry or ""
    style = style or ""
    tone = tone or ""
    audience = audience or ""

    template_list = "\n".join(
        f"{t['name']} ({t['emoji']}) - {t['style']} - Best for: {', '.join(t['best_for'])}"
        for t in DESIGN_TEMPLATES
    )

    ai_result = await _ai_json(
        build_design_suggestion_prompt(
            certificate_type, industry, style, tone, audience, template_list
        )
    )
    if ai_result and isinstance(ai_result.get("recommendations"), list):
        return ai_result

    # Rule-based fallback matching the reference implementation's scoring.
    scored = []
    for template in DESIGN_TEMPLATES:
        score = 0
        best_for_lower = [bf.lower() for bf in template["best_for"]]
        if any(industry.lower() in bf for bf in best_for_lower):
            score += 3
        if style.lower() in template["style"].lower():
            score += 2
        if any(certificate_type.lower() in bf for bf in best_for_lower):
            score += 2
        scored.append({**template, "score": score})

    scored.sort(key=lambda t: t["score"], reverse=True)

    def _confidence(score: int) -> str:
        if score >= 5:
            return "high"
        if score >= 3:
            return "medium"
        return "low"

    return {
        "recommendations": [
            {
                "name": t["name"],
                "emoji": t["emoji"],
                "style": t["style"],
                "colors": t["colors"],
                "font": t["font"],
                "reason": f"Best match for {industry} industry with {style} style",
                "confidence": _confidence(t["score"]),
            }
            for t in scored[:3]
        ]
    }


async def match_template(
    certificate_type: str,
    tone: Optional[str] = None,
    industry: Optional[str] = None,
    style: Optional[str] = None,
    audience: Optional[str] = None,
    language: Optional[str] = None,
    user_text: Optional[str] = None,
) -> Dict[str, Any]:
    # No template repository exists in ai-service yet, so the curated design
    # template list stands in for it (same limit the reference JS applies).
    templates = DESIGN_TEMPLATES[:10]
    template_names = ", ".join(t["name"] for t in templates)

    ai_text = await _ai_text(
        build_template_match_prompt(
            certificate_type, style or "", industry or "", template_names
        )
    )

    best_match = None
    if ai_text:
        best_match = next((t for t in templates if t["name"] in ai_text), None)

    return {
        "best_match": best_match or templates[0],
        "top_3": templates[:3],
    }


# ---------------------------------------------------------------------------
# Certificate Preview (HTML rendering with design templates)
# ---------------------------------------------------------------------------

_TEMPLATE_STYLES: Dict[str, Dict[str, str]] = {
    "Royal Gold": {"bg": "#0d1b4b", "fg": "#FFD700", "border": "8px double #FFD700", "font": "Georgia, serif"},
    "Ivory Scroll": {"bg": "#f5f0e8", "fg": "#3d2b1f", "border": "6px solid #8b6914", "font": "Palatino Linotype, serif"},
    "Oxford Blue": {"bg": "#002147", "fg": "#f5f0e0", "border": "6px solid #c0c0c0", "font": "Book Antiqua, serif"},
    "Modern Minimal": {"bg": "#ffffff", "fg": "#212121", "border": "2px solid #1565c0", "font": "Trebuchet MS, sans-serif"},
    "Tech Dark": {"bg": "#0a0e1a", "fg": "#00e5ff", "border": "2px solid #00e5ff", "font": "Courier New, monospace"},
    "AI Blue": {"bg": "#050d1e", "fg": "#4fc3f7", "border": "2px solid #0288d1", "font": "Verdana, sans-serif"},
    "Floral Pastel": {"bg": "#fce4ec", "fg": "#6a1b9a", "border": "5px solid #ce93d8", "font": "Palatino Linotype, serif"},
    "Classic Red": {"bg": "#fff3f3", "fg": "#b71c1c", "border": "6px double #c62828", "font": "Times New Roman, serif"},
    "Harvard Crimson": {"bg": "#f8f0f0", "fg": "#1a0000", "border": "5px solid #a51c30", "font": "Garamond, serif"},
    "Saffron India": {"bg": "#fff8e1", "fg": "#e65100", "border": "5px solid #ff6f00", "font": "Georgia, serif"},
}


def render_certificate_preview(
    recipient_name: str,
    title: Optional[str] = None,
    body: Optional[str] = None,
    closing: Optional[str] = None,
    template_name: Optional[str] = None,
    logo_url: Optional[str] = None,
) -> Dict[str, Any]:
    style = _TEMPLATE_STYLES.get(template_name, _TEMPLATE_STYLES["Modern Minimal"])

    title_text = _escape_html(title) if title else "Certificate of Achievement"
    body_text = (
        _escape_html(body)
        if body
        else "This certificate is presented in recognition of outstanding performance and achievement."
    )
    closing_text = _escape_html(closing) if closing else "Congratulations"
    recipient_text = _escape_html(recipient_name)

    logo_style = ".logo { max-width: 100px; margin: 0 auto 20px; }" if logo_url else ""
    logo_html = (
        f'<img src="{_escape_html(logo_url)}" class="logo" alt="Logo">' if logo_url else ""
    )

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }}
  .certificate {{
    width: 800px; padding: 60px; background: {style['bg']}; color: {style['fg']};
    border: {style['border']}; font-family: {style['font']}; text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }}
  .header {{ letter-spacing: 6px; font-size: 11px; text-transform: uppercase; margin-bottom: 20px; opacity: 0.7; }}
  .title {{ font-size: 28px; font-weight: bold; letter-spacing: 4px; text-transform: uppercase; margin: 20px 0; }}
  .name {{ font-style: italic; font-size: 38px; margin: 30px 0; }}
  .body {{ font-size: 14px; line-height: 1.8; margin: 20px 0; opacity: 0.9; }}
  .closing {{ font-size: 12px; margin-top: 40px; opacity: 0.6; }}
  {logo_style}
</style>
</head>
<body>
<div class="certificate">
  <div class="header">Certificate of Achievement</div>
  {logo_html}
  <div class="title">{title_text}</div>
  <div class="name">{recipient_text}</div>
  <div class="body">{body_text}</div>
  <div class="closing">{closing_text}</div>
</div>
</body>
</html>"""

    return {"html": html, "template": template_name, "style": style}
