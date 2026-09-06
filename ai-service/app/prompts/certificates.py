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
