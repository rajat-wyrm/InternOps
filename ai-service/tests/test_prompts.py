import sys
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.prompts.certificates import build_certificate_prompt
from app.utils.prompt_cleaner import clean_and_parse_json

HEX_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
ALLOWED_FONTS = ["Inter", "Playfair Display", "Montserrat", "Cinzel", "Roboto"]
ALLOWED_BADGES = ["classic_gold", "modern_minimal", "tech_shield", "academic_ribbon"]

def test_build_certificate_prompt_includes_context():
    user_context = "Marketing Intern"
    prompt = build_certificate_prompt(user_context)
    assert "Marketing Intern" in prompt
    assert "Output JSON:" in prompt
    assert "FEW-SHOT EXAMPLES:" in prompt

def test_clean_and_parse_json_strips_markdown():
    raw_response = """```json
    {
        "primary_color": "#1E3A8A",
        "secondary_color": "#D97706"
    }
    ```"""
    parsed = clean_and_parse_json(raw_response)
    assert parsed["primary_color"] == "#1E3A8A"
    assert parsed["secondary_color"] == "#D97706"

def test_clean_and_parse_json_with_preamble():
    raw_response = "Here is your JSON:\n{\n\"primary_color\": \"#000000\"\n}"
    parsed = clean_and_parse_json(raw_response)
    assert parsed["primary_color"] == "#000000"

def test_hex_codes_are_valid():
    raw_response = """{
        "primary_color": "#123ABC",
        "secondary_color": "#FFFFFF",
        "background_color": "#000000",
        "accent_color": "#FF5733",
        "font_family_title": "Inter",
        "font_family_body": "Roboto",
        "badge_style": "modern_minimal",
        "layout_alignment": "center",
        "design_rationale": "Test rationale"
    }"""
    parsed = clean_and_parse_json(raw_response)
    for key in ["primary_color", "secondary_color", "background_color", "accent_color"]:
        assert HEX_PATTERN.match(parsed[key]), f"{key} is not a valid hex code"

def test_fonts_and_badges_are_allowed():
    raw_response = """{
        "primary_color": "#123ABC",
        "secondary_color": "#FFFFFF",
        "background_color": "#000000",
        "accent_color": "#FF5733",
        "font_family_title": "Inter",
        "font_family_body": "Roboto",
        "badge_style": "modern_minimal",
        "layout_alignment": "center",
        "design_rationale": "Test rationale"
    }"""
    parsed = clean_and_parse_json(raw_response)
    assert parsed["font_family_title"] in ALLOWED_FONTS
    assert parsed["font_family_body"] in ALLOWED_FONTS
    assert parsed["badge_style"] in ALLOWED_BADGES
