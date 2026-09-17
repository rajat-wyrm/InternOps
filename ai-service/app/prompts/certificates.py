from typing import Dict, Any

CERTIFICATE_SYSTEM_PROMPT = """
You are an expert Graphic Design AI specializing in corporate certificate typography, color theory, and layout aesthetics.

YOUR TASK:
Analyze the input event, department, or intern achievement context, and generate a cohesive, visually appealing design specification.

STRICT FORMATTING RULES:
1. Output ONLY a raw, valid JSON object. No conversational text, no preambles, and no markdown code fences (do NOT use ```json).
2. All hex color codes MUST be valid 6-character strings starting with '#' (e.g., "#1E3A8A").
3. Ensure high visual contrast between primary/secondary colors and background colors for readability.
4. Only select font families from the allowed list: ["Inter", "Playfair Display", "Montserrat", "Cinzel", "Roboto"].
5. Only select badge styles from the allowed list: ["classic_gold", "modern_minimal", "tech_shield", "academic_ribbon"].

JSON TARGET SCHEMA:
{
    "primary_color": "string (hex code)",
    "secondary_color": "string (hex code)",
    "background_color": "string (hex code)",
    "accent_color": "string (hex code)",
    "font_family_title": "string (allowed list)",
    "font_family_body": "string (allowed list)",
    "badge_style": "string (allowed list)",
    "layout_alignment": "center" | "left",
    "design_rationale": "string (1-2 concise sentences explaining design choice)"
}
"""

FEW_SHOT_EXAMPLES = [
    {
        "input": "Cybersecurity Internship Completion with high honors in threat analysis.",
        "output": {
            "primary_color": "#0F172A",
            "secondary_color": "#0284C7",
            "background_color": "#F8FAFC",
            "accent_color": "#22C55E",
            "font_family_title": "Montserrat",
            "font_family_body": "Inter",
            "badge_style": "tech_shield",
            "layout_alignment": "center",
            "design_rationale": "A dark slate navy palette conveys security authority, complemented by vibrant blue and green accents reflecting analytical accuracy."
        }
    },
    {
        "input": "Executive Leadership & Business Development Summer Program.",
        "output": {
            "primary_color": "#1E3A8A",
            "secondary_color": "#D97706",
            "background_color": "#FFFBEB",
            "accent_color": "#B45309",
            "font_family_title": "Cinzel",
            "font_family_body": "Playfair Display",
            "badge_style": "classic_gold",
            "layout_alignment": "center",
            "design_rationale": "Deep royal blue combined with warm gold accents and serif typography provides a classic, prestigious feel suited for executive honors."
        }
    }
]

def build_certificate_prompt(user_context: str) -> str:
    """Builds the complete prompt string including context and few-shot guidance."""
    few_shot_str = "\n\n".join(
        f"Input Example: {ex['input']}\nOutput JSON:\n{ex['output']}" 
        for ex in FEW_SHOT_EXAMPLES
    )
    
    return (
        f"{CERTIFICATE_SYSTEM_PROMPT}\n\n"
        f"FEW-SHOT EXAMPLES:\n{few_shot_str}\n\n"
        f"NOW GENERATE FOR THIS INPUT:\n"
        f"Input: {user_context}\n"
        f"Output JSON:"
    )


def build_achievement_prompt(
    recipient_name: str,
    recognition_type: str,
    core_achievement: str,
    desired_tone: str,
) -> str:
    """Prompt for a short achievement statement (Group 1 - text generation)."""
    return (
        "Generate a professional achievement statement for a certificate.\n"
        f"Recipient: {recipient_name}\n"
        f"Recognition Type: {recognition_type}\n"
        f"Achievement: {core_achievement}\n"
        f"Tone: {desired_tone}\n\n"
        "Provide a concise, professional achievement statement (2-3 sentences). "
        "Return ONLY the statement text, no preamble, no quotes."
    )


def build_content_prompt(prompt: str, tone: str, content_type: str) -> str:
    """Prompt for general certificate-related content generation."""
    return (
        f"Generate {content_type} content with a {tone} tone:\n"
        f"{prompt}\n\n"
        "Provide well-structured content appropriate for a certificate. "
        "Return ONLY the generated text, no preamble."
    )


def build_tone_prompt(
    certificate_type: str,
    recipient_name: str,
    company_name: str,
    achievement: str,
    tone: str,
) -> str:
    """Prompt for tone-customized certificate text (title/body/closing)."""
    return (
        "You are an expert certificate content writer.\n"
        "Generate certificate text for:\n"
        f"- Certificate Type: {certificate_type}\n"
        f"- Recipient Name: {recipient_name}\n"
        f"- Company Name: {company_name}\n"
        f"- Achievement: {achievement}\n"
        f"- Tone: {tone}\n"
        'Return ONLY a JSON object with keys: "title", "body", "closing". No extra text.'
    )


def build_language_prompt(
    certificate_type: str,
    recipient_name: str,
    company_name: str,
    achievement: str,
    language: str,
) -> str:
    """Prompt for multi-language certificate text generation."""
    return (
        "You are an expert multilingual certificate content writer.\n"
        f"Generate certificate text in {language} language for:\n"
        f"- Certificate Type: {certificate_type}\n"
        f"- Recipient Name: {recipient_name} (do NOT translate the name)\n"
        f"- Company Name: {company_name} (do NOT translate the name)\n"
        f"- Achievement: {achievement}\n"
        'Return ONLY a JSON object with keys: "title", "body", "closing", "language". '
        "No extra text."
    )


def build_template_match_prompt(
    certificate_type: str,
    style: str,
    industry: str,
    template_names: str,
) -> str:
    """Prompt for matching a certificate request to an available design template."""
    return (
        f"Given a {certificate_type} certificate with {style} style for the "
        f"{industry} industry:\n"
        f"Available templates: {template_names}\n\n"
        "Which template would be most appropriate? Return just the template name."
    )


def build_design_suggestion_prompt(
    certificate_type: str,
    industry: str,
    style: str,
    tone: str,
    audience: str,
    template_list: str,
) -> str:
    """Prompt for ranking design templates for a certificate request."""
    return (
        f"Given a {certificate_type} certificate for {industry} industry with "
        f"{style} style and {tone} tone for {audience} audience:\n\n"
        f"Available templates:\n{template_list}\n\n"
        "Recommend the top 3 best template matches. For each, explain why it fits.\n"
        'Return a JSON object with key "recommendations" containing an array of '
        'objects with "name", "reason", and "confidence" (high/medium/low).'
    )


def build_beautify_prompt(name: str, company: str, achievement: str) -> str:
    """Prompt used to lightly polish certificate text during validation."""
    return (
        "Rewrite the following certificate details into a single polished, "
        "professional sentence suitable for printing on a certificate. "
        "Do not invent new facts.\n"
        f"Name: {name}\n"
        f"Company: {company}\n"
        f"Achievement: {achievement}\n\n"
        "Return ONLY the resulting sentence, no preamble, no quotes."
    )
