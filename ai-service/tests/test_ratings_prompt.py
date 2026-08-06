import pytest
from app.utils.prompt_cleaner import clean_and_parse_json

def test_clean_and_parse_valid_json():
    response = '{"score": 9, "reason": "Strong attendance and verified tasks"}'
    parsed = clean_and_parse_json(response)
    assert parsed["score"] == 9
    assert "reason" in parsed

def test_clean_and_parse_with_markdown():
    response = "```json\n{\"score\": 7, \"reason\": \"Needs focus on tasks\"}\n```"
    parsed = clean_and_parse_json(response)
    assert parsed["score"] == 7

def test_clean_and_parse_invalid_json():
    response = "Here is your evaluation:\n```json\n{bad json}\n```"
    parsed = clean_and_parse_json(response)
    assert parsed["score"] is None
    assert "Parsing failed" in parsed["reason"]
