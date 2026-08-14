import re
from fastapi import HTTPException, status

INJECTION_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"forget (all )?(prior|previous) (rules|prompts)",
    r"you are now in (developer|dan|jailbreak) mode",
    r"override (system|safety) settings",
    r"system prompt:",
    r"```system",
]

def sanitize_user_input(text: str, max_length: int = 2000) -> str:
    if not text or not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt text cannot be empty."
        )

    cleaned = text.strip()

    if len(cleaned) > max_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Prompt exceeds maximum allowed length of {max_length} characters."
        )

    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Security Violation: Input contains forbidden system override instructions."
            )

    cleaned = cleaned.replace("```", "'''")
    return cleaned

sanitize_prompt = sanitize_user_input
