import re
import json
from typing import Dict, Any

def clean_and_parse_json(raw_response: str) -> Dict[str, Any]:
    """Strips markdown code blocks, preambles, and parses raw text into a dict."""
    cleaned = raw_response.strip()
    
    # Strip markdown ```json ... ``` fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()
    
    # Extract outer braces if surrounding conversational text remains
    match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1)
        
    return json.loads(cleaned)
