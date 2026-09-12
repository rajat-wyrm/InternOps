import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.utils.prompt_cleaner import clean_and_parse_json


def test_parses_valid_json():
    response = '{"score": 9, "reason": "Strong attendance"}'

    parsed = clean_and_parse_json(response)

    assert parsed["score"] == 9


def test_strips_markdown_fences():
    response = '```json\n{"score": 7, "reason": "Needs focus"}\n```'

    parsed = clean_and_parse_json(response)

    assert parsed["score"] == 7


def test_returns_fallback_on_invalid_json():
    response = 'Here is your evaluation:\n```json\n{bad json}\n```'

    parsed = clean_and_parse_json(response)

    assert parsed["score"] is None
    assert "Parsing failed" in parsed["reason"]